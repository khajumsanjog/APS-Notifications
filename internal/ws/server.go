package ws

import (
	"context"
	"fmt"
	"net/http"
	"time"

	"github.com/go-chi/chi/v5"
	"github.com/khajumsanjog/aps/internal/store"
	"nhooyr.io/websocket"
)

type Server struct {
	hub             *Hub
	store           store.Store
	activityTimeout time.Duration
}

func NewServer(hub *Hub, st store.Store, activityTimeout time.Duration) *Server {
	return &Server{
		hub:             hub,
		store:           st,
		activityTimeout: activityTimeout,
	}
}

func (s *Server) Routes() http.Handler {
	r := chi.NewRouter()

	r.Get("/{app_key}", s.HandleWebSocket)
	r.Get("/app/{app_key}", s.HandleWebSocket)
	r.Get("/ws/app/{app_key}", s.HandleWebSocket)
	r.Get("/healthz", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"status":"ok","service":"aps-ws"}`))
	})

	return r
}

func (s *Server) HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	appKey := chi.URLParam(r, "app_key")
	if appKey == "" {
		http.Error(w, "Missing app_key in URL", http.StatusBadRequest)
		return
	}

	// Lookup app
	ctx, cancel := context.WithTimeout(r.Context(), 3*time.Second)
	defer cancel()

	app, err := s.store.GetAppByKey(ctx, appKey)
	if err != nil {
		http.Error(w, fmt.Sprintf("Application key %s not found", appKey), http.StatusNotFound)
		return
	}

	// Accept WebSocket connection
	conn, err := websocket.Accept(w, r, &websocket.AcceptOptions{
		InsecureSkipVerify: true, // Allow all origins like Pusher does
	})
	if err != nil {
		return
	}

	client := NewClient(s.hub, conn, app.ID, appKey)
	s.hub.Register(client)

	go client.WritePump()
	client.ReadPump(s.activityTimeout)
}
