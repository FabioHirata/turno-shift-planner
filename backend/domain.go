package main

import (
	"errors"
	"fmt"
	"strconv"
)

const WeekID = "2026-11-02"
const MaxRevision int64 = 9007199254740991 // JavaScript's largest exact integer.
var People = []string{"ana", "bruno", "clara", "davi"}

type Assignments map[string][]string
type Availability map[string]map[string][]string
type State struct {
	Version      int          `json:"version"`
	Revision     int64        `json:"revision"`
	Week         string       `json:"week"`
	Assignments  Assignments  `json:"assignments"`
	Availability Availability `json:"availability"`
}
type Conflict struct {
	PersonID string `json:"personId"`
	Day      *int   `json:"day,omitempty"`
	Type     string `json:"type"`
}
type Coverage struct {
	Morning   int `json:"morning"`
	Afternoon int `json:"afternoon"`
}
type Report struct {
	Covered    int            `json:"covered"`
	Total      int            `json:"total"`
	TotalHours int            `json:"totalHours"`
	Hours      map[string]int `json:"hours"`
	Coverage   []Coverage     `json:"coverage"`
	Conflicts  []Conflict     `json:"conflicts"`
}
type Response struct {
	State
	Report Report `json:"report"`
}

func demo() State {
	return State{1, 1, WeekID,
		Assignments{
			"ana":   {"morning", "morning", "morning", "morning", "morning", "off", "off"},
			"bruno": {"afternoon", "off", "off", "afternoon", "off", "morning", "morning"},
			"clara": {"off", "afternoon", "afternoon", "off", "afternoon", "off", "off"},
			"davi":  {"off", "off", "off", "off", "off", "afternoon", "off"},
		}, Availability{
			"ana":   {"5": {"morning", "afternoon"}, "6": {"morning", "afternoon"}},
			"bruno": {"2": {"morning"}}, "clara": {"1": {"afternoon"}}, "davi": {"0": {"morning"}},
		}}
}
func knownPerson(id string) bool {
	for _, p := range People {
		if id == p {
			return true
		}
	}
	return false
}
func validShift(s string) bool { return s == "off" || s == "morning" || s == "afternoon" }
func validDay(day int) bool    { return day >= 0 && day <= 6 }
func validate(s State) error {
	if s.Version != 1 || s.Week != WeekID || s.Revision < 1 || s.Revision > MaxRevision {
		return errors.New("invalid state metadata")
	}
	if len(s.Assignments) != len(People) || len(s.Availability) != len(People) {
		return errors.New("exactly four known people are required")
	}
	for _, p := range People {
		shifts, ok := s.Assignments[p]
		if !ok || len(shifts) != 7 {
			return fmt.Errorf("%s requires exactly seven assignments", p)
		}
		for _, shift := range shifts {
			if !validShift(shift) {
				return fmt.Errorf("invalid shift for %s", p)
			}
		}
		days, ok := s.Availability[p]
		if !ok || days == nil {
			return fmt.Errorf("availability object missing for %s", p)
		}
		for key, blocked := range days {
			day, err := strconv.Atoi(key)
			if err != nil || !validDay(day) || strconv.Itoa(day) != key {
				return errors.New("availability day must be 0 through 6")
			}
			if err := validateBlocked(blocked); err != nil {
				return err
			}
		}
	}
	return nil
}
func validateBlocked(shifts []string) error {
	if shifts == nil || len(shifts) > 2 {
		return errors.New("shifts must be an array with at most two items")
	}
	seen := map[string]bool{}
	for _, s := range shifts {
		if (s != "morning" && s != "afternoon") || seen[s] {
			return errors.New("blocked shifts must be distinct morning or afternoon values")
		}
		seen[s] = true
	}
	return nil
}
func unavailable(s State, person string, day int, shift string) bool {
	for _, blocked := range s.Availability[person][strconv.Itoa(day)] {
		if shift == blocked {
			return true
		}
	}
	return false
}
func analyze(s State) Report {
	r := Report{Total: 14, Hours: map[string]int{}, Coverage: make([]Coverage, 7), Conflicts: []Conflict{}}
	for _, p := range People {
		r.Hours[p] = 0
		for day, shift := range s.Assignments[p] {
			if shift != "off" {
				r.Hours[p] += 8
			}
			if unavailable(s, p, day, shift) {
				d := day
				r.Conflicts = append(r.Conflicts, Conflict{p, &d, "availability"})
				continue
			}
			switch shift {
			case "morning":
				r.Coverage[day].Morning++
			case "afternoon":
				r.Coverage[day].Afternoon++
			}
		}
		if r.Hours[p] > 40 {
			r.Conflicts = append(r.Conflicts, Conflict{PersonID: p, Type: "hours"})
		}
		r.TotalHours += r.Hours[p]
	}
	for _, c := range r.Coverage {
		if c.Morning > 0 {
			r.Covered++
		}
		if c.Afternoon > 0 {
			r.Covered++
		}
	}
	return r
}
func clone(s State) State {
	n := State{Version: s.Version, Revision: s.Revision, Week: s.Week, Assignments: Assignments{}, Availability: Availability{}}
	for p, shifts := range s.Assignments {
		n.Assignments[p] = append([]string{}, shifts...)
	}
	for p, days := range s.Availability {
		n.Availability[p] = map[string][]string{}
		for d, shifts := range days {
			n.Availability[p][d] = append([]string{}, shifts...)
		}
	}
	return n
}
func response(s State) Response { return Response{s, analyze(s)} }
