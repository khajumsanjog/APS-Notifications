package main

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/khajumsanjog/aps/internal/beams"
	"github.com/khajumsanjog/aps/internal/config"
	"github.com/khajumsanjog/aps/internal/crypto"
	"github.com/khajumsanjog/aps/internal/store"
	"github.com/khajumsanjog/aps/internal/webhook"
	"github.com/rs/zerolog/log"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatal().Err(err).Msg("Failed to load configuration")
	}

	masterKey := crypto.DeriveKey(cfg.MasterKey)

	var st store.Store = store.NewMemoryStore()
	if cfg.DatabaseURL != "" {
		if pg, err := store.NewPostgresStore(context.Background(), cfg.DatabaseURL); err == nil {
			st = pg
		}
	}

	wh := webhook.NewDispatcher(st, masterKey)
	beamsSvc := beams.NewService(st, masterKey)
	beamsSvc.SetWebhook(wh)

	addr := fmt.Sprintf(":%d", cfg.BeamsPort)
	srv := &http.Server{
		Addr:    addr,
		Handler: beamsSvc.Routes(),
	}

	go func() {
		log.Info().Str("addr", addr).Msg("Starting APS Beams Push Delivery Engine")
		if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			log.Fatal().Err(err).Msg("Beams server error")
		}
	}()

	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()
	_ = srv.Shutdown(ctx)
}
