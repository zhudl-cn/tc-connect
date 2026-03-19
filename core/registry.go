package core

import "fmt"

// PlatformFactory creates a Platform from config options.
type PlatformFactory func(opts map[string]any) (Platform, error)

// AgentFactory creates an Agent from config options.
type AgentFactory func(opts map[string]any) (Agent, error)

var (
	platformFactories = make(map[string]PlatformFactory)
	agentFactories    = make(map[string]AgentFactory)
)

func RegisterPlatform(name string, factory PlatformFactory) {
	platformFactories[name] = factory
}

func RegisterAgent(name string, factory AgentFactory) {
	agentFactories[name] = factory
}

func CreatePlatform(name string, opts map[string]any) (Platform, error) {
	f, ok := platformFactories[name]
	if !ok {
		return nil, fmt.Errorf("unknown platform %q", name)
	}
	return f(opts)
}

func CreateAgent(name string, opts map[string]any) (Agent, error) {
	f, ok := agentFactories[name]
	if !ok {
		return nil, fmt.Errorf("unknown agent %q", name)
	}
	return f(opts)
}
