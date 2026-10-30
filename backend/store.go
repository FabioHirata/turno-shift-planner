package main

import (
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"sync"
)

var ErrRevision = errors.New("revision_conflict")
var ErrExhausted = errors.New("revision_exhausted")
var ErrClosed = errors.New("store_closed")

type Store struct {
	mu      sync.RWMutex
	state   State
	path    string
	lock    *os.File
	closed  bool
	persist func(string, []byte) error
}

func openStore(path string) (*Store, error) {
	abs, err := filepath.Abs(path)
	if err != nil {
		return nil, err
	}
	if err = os.MkdirAll(filepath.Dir(abs), 0700); err != nil {
		return nil, err
	}
	lock, err := os.OpenFile(abs+".lock", os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0600)
	if err != nil {
		return nil, fmt.Errorf("store lock (another process or stale lock): %w", err)
	}
	s := &Store{path: abs, lock: lock, persist: atomicWrite}
	fmt.Fprintln(lock, os.Getpid())
	fail := func(err error) (*Store, error) { s.Close(); return nil, err }
	data, err := os.ReadFile(abs)
	if errors.Is(err, os.ErrNotExist) {
		s.state = demo()
		encoded, _ := json.MarshalIndent(s.state, "", "  ")
		if err = s.persist(abs, encoded); err != nil {
			return fail(err)
		}
	} else if err != nil {
		return fail(err)
	} else {
		if len(data) > 65536 {
			return fail(errors.New("stored state exceeds maximum size"))
		}
		if err = decodeStrict(data, &s.state); err != nil {
			return fail(fmt.Errorf("corrupt store: %w", err))
		}
		if err = validate(s.state); err != nil {
			return fail(fmt.Errorf("invalid store: %w", err))
		}
	}
	return s, nil
}
func (s *Store) Close() error {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.closed = true
	if s.lock == nil {
		return nil
	}
	err := s.lock.Close()
	s.lock = nil
	if e := os.Remove(s.path + ".lock"); err == nil {
		err = e
	}
	return err
}
func (s *Store) Get() State { s.mu.RLock(); defer s.mu.RUnlock(); return clone(s.state) }
func (s *Store) Update(revision int64, mutate func(*State) error) (State, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.closed {
		return clone(s.state), ErrClosed
	}
	if revision != s.state.Revision {
		return clone(s.state), ErrRevision
	}
	if revision >= MaxRevision {
		return clone(s.state), ErrExhausted
	}
	next := clone(s.state)
	if err := mutate(&next); err != nil {
		return clone(s.state), err
	}
	next.Revision++
	if err := validate(next); err != nil {
		return clone(s.state), err
	}
	encoded, err := json.MarshalIndent(next, "", "  ")
	if err != nil {
		return clone(s.state), err
	}
	if err = s.persist(s.path, encoded); err != nil {
		return clone(s.state), fmt.Errorf("persist failed: %w", err)
	}
	s.state = next
	return clone(next), nil
}
func decodeStrict(data []byte, target any) error {
	d := json.NewDecoder(bytes.NewReader(data))
	d.DisallowUnknownFields()
	if err := d.Decode(target); err != nil {
		return err
	}
	if err := d.Decode(new(any)); err != io.EOF {
		return errors.New("exactly one JSON value required")
	}
	return nil
}
func atomicWrite(path string, data []byte) error {
	dir := filepath.Dir(path)
	file, err := os.CreateTemp(dir, ".turno-*.tmp")
	if err != nil {
		return err
	}
	name := file.Name()
	defer os.Remove(name)
	defer file.Close()
	if err = file.Chmod(0600); err != nil {
		return err
	}
	if _, err = file.Write(data); err != nil {
		return err
	}
	if err = file.Sync(); err != nil {
		return err
	}
	if err = file.Close(); err != nil {
		return err
	}
	// Rename is the commit point: errors before it leave the old file intact.
	if err = os.Rename(name, path); err != nil {
		return err
	}
	// Directory sync is best effort after commit: a failure cannot honestly be reported
	// as a rejected transaction because rename already made the new state visible.
	if directory, e := os.Open(dir); e == nil {
		_ = directory.Sync()
		_ = directory.Close()
	}
	return nil
}
