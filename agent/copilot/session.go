package copilot

import (
	"bufio"
	"fmt"
	"io"
	"log/slog"
	"os/exec"
	"regexp"
	"strings"

	"tc-connect/core"

	"github.com/creack/pty"
)

// Regex to match ANSI escape codes (CSI)
var csiEscapes = regexp.MustCompile(`[\x1b\x9b][\[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]`)
// Regex to match Operating System Commands (OSC)
var oscEscapes = regexp.MustCompile(`[\x1b\x9b]\][0-9]+;[^\x07\x1b]*(\x07|\x1b\\)?`)

type Session struct {
	id     string
	events chan core.Event
}

func StartSession(id string) (core.AgentSession, error) {
	return &Session{
		id:     id,
		events: make(chan core.Event, 10),
	}, nil
}

func (s *Session) Send(prompt string) error {
	go s.runCommand(prompt)
	return nil
}

func (s *Session) runCommand(prompt string) {
	// 针对新版 native "gh copilot"
	cmd := exec.Command("gh", "copilot", "-p", prompt)
	
	// Start with PTY
	f, err := pty.Start(cmd)
	if err != nil {
		s.events <- core.Event{Type: "error", Content: fmt.Sprintf("Failed to start pty: %v", err)}
		return
	}
	defer f.Close()

	// Wait for command to finish in background
	go func() {
		cmd.Wait()
	}()

	reader := bufio.NewReader(f)
	var output strings.Builder
	
	buf := make([]byte, 1024)
	for {
		n, err := reader.Read(buf)
		if n > 0 {
			cleanChunk := stripANSI(string(buf[:n]))
			output.WriteString(cleanChunk)
		}
		if err != nil {
			if err != io.EOF && !strings.Contains(err.Error(), "input/output error") {
				slog.Error("Pty read error", "err", err)
			}
			break
		}
	}

	// Post-processing to remove noisy UI elements
	finalStr := strings.TrimSpace(output.String())
	
	// Try to extract the suggestion block
	if finalStr != "" {
		s.events <- core.Event{Type: "text", Content: finalStr}
	}
}

func stripANSI(str string) string {
	str = oscEscapes.ReplaceAllString(str, "")
	str = csiEscapes.ReplaceAllString(str, "")
	
	// Fallback for broken OSC residues caused by pty chunking
	str = strings.ReplaceAll(str, "]11;?\\", "")
	str = strings.ReplaceAll(str, "]11;?", "")
	return str
}

func (s *Session) Events() <-chan core.Event {
	return s.events
}

func (s *Session) Close() error {
	close(s.events)
	return nil
}
