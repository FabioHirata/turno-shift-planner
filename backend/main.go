package main

import (
	"context"
	"errors"
	"flag"
	"log"
	"net"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"
)

func main() {
	addr := flag.String("addr", "127.0.0.1:8080", "loopback HTTP address")
	data := flag.String("data", "data/week.json", "persistent JSON file")
	web := flag.String("web", "../dist", "directory containing the built frontend")
	flag.Parse()
	host, _, err := net.SplitHostPort(*addr)
	if err != nil || (host != "localhost" && !net.ParseIP(host).IsLoopback()) {
		log.Fatal("-addr must use localhost or a loopback IP; this demo has no authentication")
	}
	store, err := openStore(*data)
	if err != nil {
		log.Fatal(err)
	}
	defer store.Close()
	server := &http.Server{Addr: *addr, Handler: newHandler(store, *web), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 10 * time.Second, WriteTimeout: 10 * time.Second, IdleTimeout: 30 * time.Second, MaxHeaderBytes: 16 << 10}
	done := make(chan os.Signal, 1)
	shutdownDone := make(chan struct{})
	signal.Notify(done, os.Interrupt, syscall.SIGTERM)
	go func() {
		<-done
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		if err := server.Shutdown(ctx); err != nil {
			log.Print(err)
			_ = server.Close()
		}
		close(shutdownDone)
	}()
	log.Printf("Turno local Go API: http://%s/?mode=api (fictional data only)", *addr)
	err = server.ListenAndServe()
	if errors.Is(err, http.ErrServerClosed) {
		<-shutdownDone
	} else if err != nil {
		log.Print(err)
	}
}
