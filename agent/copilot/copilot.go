package copilot

import (
	"context"

	"tc-connect/core"
)

func init() {
	core.RegisterAgent("copilot", func(opts map[string]any) (core.Agent, error) {
		return &Agent{}, nil
	})
}

type Agent struct{}

func (a *Agent) Name() string {
	return "copilot"
}

func (a *Agent) StartSession(ctx context.Context, sessionID string) (core.AgentSession, error) {
	return StartSession(sessionID)
}

func (a *Agent) Stop() error {
	return nil
}
