package core

import (
	"context"
	"encoding/json"
	"fmt"
	"log/slog"
	"sync"
)

// Engine is the central orchestrator that routes messages between platforms and agents.
type Engine struct {
	platform      Platform
	agent         Agent
	sessionsMutex sync.RWMutex
	sessions      map[string]AgentSession
}

func NewEngine(platform Platform, agent Agent) *Engine {
	return &Engine{
		platform: platform,
		agent:    agent,
		sessions: make(map[string]AgentSession),
	}
}

// Start begins listening to the platform.
func (e *Engine) Start(ctx context.Context) error {
	slog.Info("Starting Engine", "platform", e.platform.Name(), "agent", e.agent.Name())
	return e.platform.Start(ctx, e.handlePlatformMessage)
}

// Stop gracefully shuts down the engine and all active sessions.
func (e *Engine) Stop() error {
	e.platform.Stop()
	e.agent.Stop()

	e.sessionsMutex.Lock()
	for _, s := range e.sessions {
		s.Close()
	}
	e.sessionsMutex.Unlock()
	return nil
}

// handlePlatformMessage routes an incoming message from the platform to the correct agent session.
func (e *Engine) handlePlatformMessage(p Platform, msg *Message) {
	ctx := context.Background()

	// Handle stop command — cancel the current session's running command.
	var cmdMsg struct {
		Cmd string `json:"__cmd"`
	}
	if json.Unmarshal([]byte(msg.Content), &cmdMsg) == nil && cmdMsg.Cmd == "stop" {
		e.sessionsMutex.RLock()
		session, exists := e.sessions[msg.SessionKey]
		e.sessionsMutex.RUnlock()
		if exists {
			session.Cancel()
		}
		return
	}

	e.sessionsMutex.Lock()
	session, exists := e.sessions[msg.SessionKey]
	e.sessionsMutex.Unlock()

	if !exists {
		// 1. Create a new session if it doesn't exist
		var err error
		session, err = e.agent.StartSession(ctx, msg.SessionKey)
		if err != nil {
			p.Reply(ctx, msg.SessionKey, fmt.Sprintf("🚨 Failed to start Copilot session: %v", err))
			return
		}

		e.sessionsMutex.Lock()
		e.sessions[msg.SessionKey] = session
		e.sessionsMutex.Unlock()

		// 2. Start a background goroutine to listen to this session's output
		go e.listenSessionEvents(ctx, msg.SessionKey, session)
	}

	// 3. Send the user's prompt to the running session
	if err := session.Send(msg.Content); err != nil {
		p.Reply(ctx, msg.SessionKey, fmt.Sprintf("🚨 Failed to send message to Copilot: %v", err))
	}
}

// listenSessionEvents reads from the agent's channel and forwards to the platform as JSON events.
func (e *Engine) listenSessionEvents(ctx context.Context, sessionKey string, session AgentSession) {
	for evt := range session.Events() {
		switch evt.Type {
		case "chunk", "done", "text", "error":
			data, _ := json.Marshal(map[string]string{
				"type":    evt.Type,
				"content": evt.Content,
			})
			e.platform.Reply(ctx, sessionKey, string(data))
		}
	}

	// When the event channel closes, remove the session from the engine
	e.sessionsMutex.Lock()
	delete(e.sessions, sessionKey)
	e.sessionsMutex.Unlock()
	slog.Info("Session closed and removed", "sessionKey", sessionKey)
}
