# Magic Rabbit AI (Vite Edition)

This is an implementation of the cooperative logic game **Magic Rabbit**, built using **Vite** and plain JavaScript.

You play with (or against) 1 to 3 AI players. Each AI mimics a human player with **limited memory**, restricted to only one remembered rabbit at a time. 

The goal: correctly align rabbits and hats from 1 to 9 — before the timer runs out!

<img width="895" alt="Screenshot 2025-07-05 at 16 49 14" src="https://github.com/user-attachments/assets/4e9932e7-ede2-4dc8-a709-891b4d41032a" />

---

## Gameplay Rules

- Each pile contains a face-down rabbit 🐇 and a visible hat 🎩.
- The goal is to align piles in order: Rabbit 1 under Hat 1, Rabbit 2 under Hat 2, … up to 9.
- On your turn, you can:
  - Look under a rabbit
  - Swap two hats
  - Swap two full piles (rabbit + hat)
  - Move a dove token to block a pile

## Features

- Turn-based interaction (Human ↔ AI ↔ AI…)
- Timer & human-paced AI delays
- Simple but effective AI with limited memory

---

## 🛠️ Credits

Inspired by the board game **Magic Rabbit** (Lumberjacks Studio).

**This project was integrally written by an AI (GitHub Copilot) using peer programming. No human directly wrote or edited the code; all implementation, refactoring, and improvements were performed by the AI.**
