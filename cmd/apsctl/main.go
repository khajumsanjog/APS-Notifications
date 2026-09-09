package main

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"

	"github.com/khajumsanjog/aps/internal/auth"
	"nhooyr.io/websocket"
)

func main() {
	if len(os.Args) < 2 {
		printHelp()
		os.Exit(1)
	}

	command := os.Args[1]

	switch command {
	case "status":
		handleStatus()
	case "tail":
		handleTail()
	case "trigger":
		handleTrigger()
	case "push":
		handlePush()
	case "help", "--help", "-h":
		printHelp()
	default:
		fmt.Printf("Unknown command: %s\n\n", command)
		printHelp()
		os.Exit(1)
	}
}

func printHelp() {
	fmt.Print(`apsctl — Developer & Operator CLI for APS (Aadhan Pradhan Services)

Usage:
  apsctl <command> [arguments]

Commands:
  status                                          Check APS platform health
  tail <app_key> <channel>                        Stream live events from a channel
  trigger <app_id> <key> <secret> <ch> <ev> <data> Trigger Pusher event from CLI
  push <instance_id> <interest> <title> <body>    Publish Beams push to interest

Environment Variables:
  APS_URL        Base URL (default: http://localhost:8080)
  APS_WS_URL     WebSocket URL (default: ws://localhost:8080)
`)
}

func getBaseURL() string {
	if u := os.Getenv("APS_URL"); u != "" {
		return u
	}
	return "http://localhost:8080"
}

func getWSURL() string {
	if u := os.Getenv("APS_WS_URL"); u != "" {
		return u
	}
	base := getBaseURL()
	return strings.Replace(strings.Replace(base, "https://", "wss://", 1), "http://", "ws://", 1)
}

func handleStatus() {
	urlStr := getBaseURL() + "/healthz"
	resp, err := http.Get(urlStr)
	if err != nil {
		fmt.Printf("❌ Failed to reach APS at %s: %v\n", urlStr, err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	fmt.Printf("✅ Status 200 OK — APS is running!\n%s\n", string(body))
}

func handleTail() {
	if len(os.Args) < 4 {
		fmt.Println("Usage: apsctl tail <app_key> <channel>")
		os.Exit(1)
	}

	appKey := os.Args[2]
	channelName := os.Args[3]

	endpoint := fmt.Sprintf("%s/app/%s", getWSURL(), appKey)
	fmt.Printf("Connecting to %s ...\n", endpoint)

	ctx := context.Background()
	conn, _, err := websocket.Dial(ctx, endpoint, nil)
	if err != nil {
		fmt.Printf("❌ Failed to connect: %v\n", err)
		os.Exit(1)
	}
	defer conn.Close(websocket.StatusNormalClosure, "")

	// 1. Read connection established
	_, msgBytes, err := conn.Read(ctx)
	if err != nil {
		fmt.Printf("❌ Connection error: %v\n", err)
		os.Exit(1)
	}

	fmt.Printf("Connected! Handshake: %s\n", string(msgBytes))
	fmt.Printf("Subscribing to '%s' ...\n", channelName)

	// Subscribe
	subMsg, _ := json.Marshal(map[string]interface{}{
		"event": "pusher:subscribe",
		"data": map[string]string{
			"channel": channelName,
		},
	})
	_ = conn.Write(ctx, websocket.MessageText, subMsg)

	fmt.Printf("Listening for live events on [%s] (Ctrl+C to exit)...\n\n", channelName)

	for {
		_, msg, err := conn.Read(ctx)
		if err != nil {
			fmt.Printf("Connection closed: %v\n", err)
			return
		}
		var parsed map[string]interface{}
		_ = json.Unmarshal(msg, &parsed)
		prettyJSON, _ := json.MarshalIndent(parsed, "", "  ")
		fmt.Printf("[%s] Event received:\n%s\n\n", time.Now().Format("15:04:05"), string(prettyJSON))
	}
}

func handleTrigger() {
	if len(os.Args) < 8 {
		fmt.Println("Usage: apsctl trigger <app_id> <key> <secret> <channel> <event> <data_json>")
		os.Exit(1)
	}

	appID := os.Args[2]
	key := os.Args[3]
	secret := os.Args[4]
	channel := os.Args[5]
	event := os.Args[6]
	dataStr := os.Args[7]

	body := []byte(fmt.Sprintf(`{"name":"%s","channels":["%s"],"data":%s}`, event, channel, dataStr))
	reqPath := fmt.Sprintf("/apps/%s/events", appID)

	_, signedParams := auth.SignRESTRequest("POST", reqPath, key, secret, make(url.Values), body, time.Now())

	fullURL := fmt.Sprintf("%s%s?%s", getBaseURL(), reqPath, signedParams.Encode())

	req, _ := http.NewRequest("POST", fullURL, bytes.NewReader(body))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("❌ Failed to trigger event: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		fmt.Printf("✅ Event '%s' triggered successfully on channel '%s'!\n", event, channel)
	} else {
		fmt.Printf("❌ Trigger failed (status %d): %s\n", resp.StatusCode, string(respBody))
	}
}

func handlePush() {
	if len(os.Args) < 6 {
		fmt.Println("Usage: apsctl push <instance_id> <interest> <title> <body>")
		os.Exit(1)
	}

	instanceID := os.Args[2]
	interest := os.Args[3]
	title := os.Args[4]
	bodyText := os.Args[5]

	payload := map[string]interface{}{
		"interests": []string{interest},
		"fcm": map[string]interface{}{
			"notification": map[string]string{
				"title": title,
				"body":  bodyText,
			},
		},
		"apns": map[string]interface{}{
			"aps": map[string]interface{}{
				"alert": map[string]string{
					"title": title,
					"body":  bodyText,
				},
			},
		},
	}

	payloadBytes, _ := json.Marshal(payload)
	urlStr := fmt.Sprintf("%s/beams/%s/publishes/interests", getBaseURL(), instanceID)

	req, _ := http.NewRequest("POST", urlStr, bytes.NewReader(payloadBytes))
	req.Header.Set("Content-Type", "application/json")

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("❌ Failed to publish push: %v\n", err)
		os.Exit(1)
	}
	defer resp.Body.Close()

	respBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		fmt.Printf("✅ Push published to interest '%s'!\nResponse: %s\n", interest, string(respBody))
	} else {
		fmt.Printf("❌ Push failed (status %d): %s\n", resp.StatusCode, string(respBody))
	}
}
