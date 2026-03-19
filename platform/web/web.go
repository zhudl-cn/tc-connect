package web

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"sync"
	"time"

	"tc-connect/core"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for local testing
	},
}

func init() {
	core.RegisterPlatform("web", func(opts map[string]any) (core.Platform, error) {
		port, _ := opts["port"].(string)
		if port == "" {
			port = "8080"
		}
		return New(port), nil
	})
}

type Platform struct {
	port   string
	server *http.Server

	// Manage active websocket connections per session
	conns   map[string]*websocket.Conn
	connsMu sync.RWMutex
}

func New(port string) *Platform {
	return &Platform{
		port:  port,
		conns: make(map[string]*websocket.Conn),
	}
}

func (p *Platform) Name() string {
	return "web"
}

func (p *Platform) Start(ctx context.Context, handler core.MessageHandler) error {
	mux := http.NewServeMux()

	// Serve the React frontend pages
	mux.Handle("/", http.FileServer(http.Dir("./ui/dist")))

	// Handle WebSocket connections
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("Failed to upgrade websocket", "err", err)
			return
		}

		// Use remote IP + timestamp as a unique session ID, or the frontend can pass one.
		// For simplicity, we just use the remote addr.
		sessionID := r.RemoteAddr

		p.connsMu.Lock()
		p.conns[sessionID] = conn
		p.connsMu.Unlock()

		slog.Info("Client connected via WebSocket", "session", sessionID)

		// Start reading messages from the WebSocket
		go func() {
			defer func() {
				p.connsMu.Lock()
				delete(p.conns, sessionID)
				p.connsMu.Unlock()
				conn.Close()
				slog.Info("Client disconnected", "session", sessionID)
			}()

			for {
				messageType, pMessage, err := conn.ReadMessage()
				if err != nil {
					break
				}

				if messageType == websocket.TextMessage {
					text := string(pMessage)
					if text != "" {
						go handler(p, &core.Message{
							SessionKey: sessionID,
							Content:    text,
						})
					}
				}
			}
		}()
	})

	p.server = &http.Server{
		Addr:    ":" + p.port,
		Handler: mux,
	}

	go func() {
		<-ctx.Done()
		p.server.Shutdown(context.Background())
	}()

	slog.Info("Web UI Server started", "url", "http://localhost:"+p.port)
	err := p.server.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		return err
	}
	return nil
}

func (p *Platform) Reply(ctx context.Context, sessionKey string, content string) error {
	p.connsMu.RLock()
	conn, ok := p.conns[sessionKey]
	p.connsMu.RUnlock()

	if !ok {
		return fmt.Errorf("client %s is not connected anymore", sessionKey)
	}

	conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
	return conn.WriteMessage(websocket.TextMessage, []byte(content))
}

func (p *Platform) Stop() error {
	if p.server != nil {
		return p.server.Shutdown(context.Background())
	}
	return nil
}
