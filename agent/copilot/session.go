package copilot

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"os/exec"
	"regexp"
	"strings"
	"sync"

	"tc-connect/core"

	"github.com/creack/pty"
)

// Regex to match ANSI escape codes (CSI)
var csiEscapes = regexp.MustCompile(`[\x1b\x9b][\[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]`)

// Regex to match Operating System Commands (OSC)
var oscEscapes = regexp.MustCompile(`[\x1b\x9b]\][0-9]+;[^\x07\x1b]*(\x07|\x1b\\)?`)

// incomingMsg is the JSON shape sent by the frontend.
type incomingMsg struct {
	SystemInstruction string `json:"system_instruction"`
	UserPrompt        string `json:"user_prompt"`
	Model             string `json:"model"`
}

type Session struct {
	id       string
	events   chan core.Event
	cancelFn context.CancelFunc
	cancelMu sync.Mutex
}

func StartSession(id string) (core.AgentSession, error) {
	return &Session{
		id:     id,
		events: make(chan core.Event, 10),
	}, nil
}

func (s *Session) Send(raw string) error {
	go s.runCommand(raw)
	return nil
}

// Cancel terminates the currently running command, if any.
func (s *Session) Cancel() {
	s.cancelMu.Lock()
	defer s.cancelMu.Unlock()
	if s.cancelFn != nil {
		s.cancelFn()
	}
}

func (s *Session) runCommand(raw string) {
	// Parse the JSON envelope from the frontend.
	// If parsing fails, treat the whole string as the prompt.
	prompt := raw
	model := ""

	var msg incomingMsg
	if err := json.Unmarshal([]byte(raw), &msg); err == nil && msg.UserPrompt != "" {
		if msg.SystemInstruction != "" {
			prompt = msg.SystemInstruction + "\n\n" + msg.UserPrompt
		} else {
			prompt = msg.UserPrompt
		}
		model = msg.Model
	}

	args := []string{"copilot", "-p", prompt}
	if model != "" {
		args = append(args, "--model", model)
	}

	// Create a cancellable context for this command run.
	ctx, cancel := context.WithCancel(context.Background())
	s.cancelMu.Lock()
	s.cancelFn = cancel
	s.cancelMu.Unlock()
	defer func() {
		cancel() // always release context resources
		s.cancelMu.Lock()
		s.cancelFn = nil
		s.cancelMu.Unlock()
	}()

	cmd := exec.CommandContext(ctx, "gh", args...)

	// Start with PTY
	f, err := pty.Start(cmd)
	if err != nil {
		s.events <- core.Event{Type: "error", Content: fmt.Sprintf("Failed to start pty: %v", err)}
		return
	}
	defer f.Close()

	go func() { cmd.Wait() }()

	reader := bufio.NewReader(f)
	buf := make([]byte, 1024)
	for {
		n, err := reader.Read(buf)
		if n > 0 {
			if cleaned := stripANSI(string(buf[:n])); strings.TrimSpace(cleaned) != "" && ctx.Err() == nil {
				s.events <- core.Event{Type: "chunk", Content: cleaned}
			}
		}
		if err != nil {
			if err != io.EOF && !strings.Contains(err.Error(), "input/output error") {
				slog.Error("Pty read error", "err", err)
			}
			break
		}
	}

	if ctx.Err() == nil {
		s.events <- core.Event{Type: "done"}
	}
}

func stripANSI(str string) string {
	str = oscEscapes.ReplaceAllString(str, "")
	str = csiEscapes.ReplaceAllString(str, "")
	str = strings.ReplaceAll(str, "]11;?\\", "")
	str = strings.ReplaceAll(str, "]11;?", "")
	return str
}

func (s *Session) Events() <-chan core.Event {
	return s.events
}

func (s *Session) Close() error {
	s.Cancel() // terminate any running command
	close(s.events)
	return nil
}
