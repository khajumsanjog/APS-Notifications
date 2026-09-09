package metrics

import (
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	ActiveConnections = promauto.NewGaugeVec(prometheus.GaugeOpts{
		Namespace: "aps",
		Subsystem: "ws",
		Name:      "active_connections",
		Help:      "Current count of active WebSocket connections",
	}, []string{"app_id"})

	EventsTriggered = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "aps",
		Subsystem: "channels",
		Name:      "events_triggered_total",
		Help:      "Total number of events triggered",
	}, []string{"app_id", "channel"})

	PushesSent = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "aps",
		Subsystem: "beams",
		Name:      "pushes_sent_total",
		Help:      "Total push notifications sent",
	}, []string{"instance_id", "platform"})

	PushesFailed = promauto.NewCounterVec(prometheus.CounterOpts{
		Namespace: "aps",
		Subsystem: "beams",
		Name:      "pushes_failed_total",
		Help:      "Total push notifications failed",
	}, []string{"instance_id", "platform"})
)
