package web

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os/exec"
	"strings"
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

// cors writes common CORS headers for API responses.
func cors(w http.ResponseWriter) {
	w.Header().Set("Access-Control-Allow-Origin", "*")
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
}

// fetchModels tries several gh commands to list available Copilot models.
// Falls back to a well-known list if all commands fail.
func fetchModels() []string {
	// Strategy 1: gh copilot models (newer CLI versions)
	if out, err := exec.Command("gh", "copilot", "models").Output(); err == nil {
		var models []string
		for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
			line = strings.TrimSpace(line)
			if line != "" && !strings.HasPrefix(line, "#") {
				models = append(models, line)
			}
		}
		if len(models) > 0 {
			return models
		}
	}

	// Strategy 2: gh api /copilot/models (Copilot-specific endpoint)
	if out, err := exec.Command("gh", "api", "/copilot/models").Output(); err == nil {
		type modelItem struct {
			ID   string `json:"id"`
			Name string `json:"name"`
		}
		var resp struct {
			Models []modelItem `json:"models"`
		}
		if json.Unmarshal(out, &resp) == nil && len(resp.Models) > 0 {
			result := make([]string, len(resp.Models))
			for i, m := range resp.Models {
				if m.Name != "" {
					result[i] = m.Name
				} else {
					result[i] = m.ID
				}
			}
			return result
		}
		var items []modelItem
		if json.Unmarshal(out, &items) == nil && len(items) > 0 {
			result := make([]string, len(items))
			for i, m := range items {
				if m.Name != "" {
					result[i] = m.Name
				} else {
					result[i] = m.ID
				}
			}
			return result
		}
	}

	// Strategy 3: gh api /models (GitHub Models marketplace)
	if out, err := exec.Command("gh", "api", "/models").Output(); err == nil {
		var items []struct {
			Name string `json:"name"`
		}
		if json.Unmarshal(out, &items) == nil && len(items) > 0 {
			models := make([]string, len(items))
			for i, item := range items {
				models[i] = item.Name
			}
			return models
		}
	}

	// Fallback: known GitHub Copilot models as of 2025
	return []string{
		"claude-3.7-sonnet",
		"claude-3.5-sonnet",
		"gpt-4o",
		"gpt-4o-mini",
		"gpt-4.5",
		"o3-mini",
		"o1",
	}
}

func (p *Platform) Start(ctx context.Context, handler core.MessageHandler) error {
	mux := http.NewServeMux()

	// Serve the React frontend
	mux.Handle("/", http.FileServer(http.Dir("./ui/dist")))

	// GET /api/models — return available Copilot model list
	mux.HandleFunc("/api/models", func(w http.ResponseWriter, r *http.Request) {
		cors(w)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodGet {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		models := fetchModels()
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(models)
	})

	// POST /api/upload — receive a file and return its text content
	mux.HandleFunc("/api/upload", func(w http.ResponseWriter, r *http.Request) {
		cors(w)
		if r.Method == http.MethodOptions {
			w.WriteHeader(http.StatusNoContent)
			return
		}
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := r.ParseMultipartForm(10 << 20); err != nil { // 10 MB limit
			http.Error(w, "file too large or invalid form", http.StatusBadRequest)
			return
		}
		file, header, err := r.FormFile("file")
		if err != nil {
			http.Error(w, "missing file field", http.StatusBadRequest)
			return
		}
		defer file.Close()
		content, err := io.ReadAll(file)
		if err != nil {
			http.Error(w, "failed to read file", http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(map[string]string{
			"name":    header.Filename,
			"content": string(content),
		})
	})

	// Handle WebSocket connections
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		conn, err := upgrader.Upgrade(w, r, nil)
		if err != nil {
			slog.Error("Failed to upgrade websocket", "err", err)
			return
		}

		sessionID := r.URL.Query().Get("session_id")
		if sessionID == "" {
			sessionID = r.RemoteAddr // fallback for clients without session_id
		}

		p.connsMu.Lock()
		p.conns[sessionID] = conn
		p.connsMu.Unlock()

		slog.Info("Client connected via WebSocket", "session", sessionID)

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
