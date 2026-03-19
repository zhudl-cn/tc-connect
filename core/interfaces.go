package core

import "context"

// MessageHandler is called by platforms when a new message arrives.
type MessageHandler func(p Platform, msg *Message)

// Message payload
type Message struct {
	SessionKey string
	Content    string
}

// Platform abstracts a messaging platform (Slack, Teams, etc.).
type Platform interface {
	Name() string
	Start(ctx context.Context, handler MessageHandler) error
	Reply(ctx context.Context, sessionKey string, content string) error
	Stop() error
}

// Agent abstracts an AI coding assistant (Copilot CLI).
type Agent interface {
	Name() string
	StartSession(ctx context.Context, sessionID string) (AgentSession, error)
	Stop() error
}

// Event is emitted by a running agent session.
type Event struct {
	Type    string // "text", "error", etc.
	Content string
}

// AgentSession represents a running interactive agent process.
type AgentSession interface {
	Send(prompt string) error
	Cancel()
	Events() <-chan Event
	Close() error
}
