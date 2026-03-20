package main

import (
	"context"
	"log/slog"
	"os"
	"os/signal"
	"syscall"

	_ "tc-connect/agent/copilot"
	"tc-connect/core"
	_ "tc-connect/platform/web"
)

func main() {
	// 1. Setup standard logger
	slog.SetDefault(slog.New(slog.NewTextHandler(os.Stdout, &slog.HandlerOptions{Level: slog.LevelDebug})))

	// 2. Load config from Environment Variables
	platformOpts := map[string]any{
		"port": os.Getenv("WEB_PORT"), // Optional, defaults to "8080" inside web.go
	}

	// 3. Instantiate Web Platform via Registry
	platform, err := core.CreatePlatform("web", platformOpts)
	if err != nil {
		slog.Error("Failed to create platform", "err", err)
		os.Exit(1)
	}

	// 4. Instantiate Copilot Agent via Registry
	agentOpts := map[string]any{}
	agent, err := core.CreateAgent("copilot", agentOpts)
	if err != nil {
		slog.Error("Failed to create agent", "err", err)
		os.Exit(1)
	}

	// 5. Build and run the Engine!
	engine := core.NewEngine(platform, agent)

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()

	go func() {
		if err := engine.Start(ctx); err != nil {
			slog.Error("Engine stopped with error", "err", err)
			cancel()
		}
	}()

	// 6. Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	slog.Info("Shutting down engine...")
	cancel()
	engine.Stop()
	slog.Info("Server exiting")
}
