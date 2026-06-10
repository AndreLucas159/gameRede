import { ChangeDetectionStrategy, Component, signal, OnInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser, KeyValuePipe, NgTemplateOutlet } from '@angular/common';
import { RouterOutlet } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

interface ChatMessage {
  user: string;
  text: string;
  type: 'message' | 'achievement';
}

interface RankedUser {
  name: string;
  score: number;
}

@Component({
  changeDetection: ChangeDetectionStrategy.OnPush,
  selector: 'app-root',
  imports: [RouterOutlet, MatIconModule, KeyValuePipe, NgTemplateOutlet],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App implements OnInit, OnDestroy {
  private platformId = inject(PLATFORM_ID);
  private ws: WebSocket | null = null;

  currentUser = signal<{name: string, title: string, avatar: string}>({
    name: 'LUCAS SANTOS',
    title: 'Master of Subnets',
    avatar: 'https://ui-avatars.com/api/?name=Lucas+S&background=22d3ee&color=fff'
  });

  serverStatus = signal<'Online (WebSocket Connected)' | 'Connecting...' | 'Offline'>('Connecting...');
  
  chatMessages = signal<ChatMessage[]>([
    { user: 'Ana Beatriz', text: "Ana Beatriz acabou de ganhar 'Rei dos Roteadores'", type: 'achievement' },
    { user: 'Marcos', text: "Alguém sabe como configurar o RIP nessa etapa?", type: 'message' },
    { user: 'LUCAS', text: "Usa o comando 'ip route 0.0.0.0' no console!", type: 'message' }
  ]);

  ranking = signal<RankedUser[]>([
    { name: 'Lucas Santos', score: 0 },
    { name: 'Ana Beatriz', score: 11200 },
    { name: 'Marcos Silva', score: 10890 }
  ]);

  newMessage = signal('');
  latency = signal('12ms');

  // Game States
  score = signal(0);
  unlockedStages = signal<number[]>([1]);
  completedStages = signal<number[]>([]);
  currentStage = signal(1);
  currentPhase = signal<any>(null);
  selectedOptionKey = signal<string | null>(null);
  feedbackActive = signal(false);
  feedbackIsCorrect = signal(false);
  correctAnswerToShow = signal('');
  gameOver = signal(false);
  isSuccess = signal(false);
  // Theory & Retries
  theoryRead = signal(false);
  retryCount = signal(0);

  // Arcade: Shared State
  arcadeGameOver = signal(false);
  arcadeCompleted = signal(false);
  arcadeLoop: any = null;

  // Stage 1: Tiro ao Alvo (Target Shooting)
  targetHits = signal(0);
  targets: { x: number, y: number, vx: number, label: string, correct: boolean, radius: number }[] = [];
  currentTargetPromptIndex = 0;
  targetPrompts = [
    { question: 'Acerte a topologia física em ESTRELA (Star):', correct: 'Estrela' },
    { question: 'Acerte a topologia de cabo principal compartilhado (BARRAMENTO):', correct: 'Barramento' },
    { question: 'Acerte a topologia onde os dados circulam em ANEL:', correct: 'Anel' },
    { question: 'Acerte a topologia resiliente com caminhos redundantes (MALHA):', correct: 'Malha' }
  ];

  // Stage 2: Aladdin's Flying Carpet (OSI/Cable Snake)
  t568bOrder = [
    'Branco-Laranja',
    'Laranja',
    'Branco-Verde',
    'Azul',
    'Branco-Azul',
    'Verde',
    'Branco-Marrom',
    'Marrom'
  ];
  snakeTargetIndex = signal(0);
  snake: { x: number, y: number }[] = [];
  snakeDir = { x: 20, y: 0 };
  snakeFood: { x: number, y: number, color: string, correct: boolean }[] = [];

  // Stage 3: Subnet Donkey Kong (IP barrel avoidance)
  dkScore = signal(0);
  dkLives = signal(3);
  dkPlayer = { x: 50, y: 226, vx: 0, vy: 0, isJumping: false, isClimbing: false, width: 16, height: 24 };
  dkBarrels: { x: number, y: number, vx: number, label: string, valid: boolean, width: 30, height: 16 }[] = [];
  dkLadders: { x: number, y1: number, y2: number, width: 20 }[] = [
    { x: 120, y1: 250, y2: 170, width: 20 },
    { x: 280, y1: 170, y2: 95, width: 20 }
  ];
  dkPlatforms = [
    { x: 0, y: 250, w: 400 },
    { x: 0, y: 170, w: 400 },
    { x: 0, y: 95, w: 400 }
  ];
  lastBarrelSpawnTime = 0;

  // Stage 4: Packet Shooter (Routing Shooter)
  routerHits = signal(0);
  routerAngle = 0; // in degrees (-60 to 60)
  routerLaser: { x: number, y: number, vx: number, vy: number, ip: string, validBucket: string } | null = null;
  routerBuckets: { x: number, y: number, vx: number, name: string, range: string, width: 80, height: 25 }[] = [];
  routerCurrentPacketIP = '';
  routerCurrentPacketTarget = '';

  // Stage 5: Firewall Space Invaders
  invadersHits = signal(0);
  invaderShield = signal(3);
  invadersShip = { x: 200, width: 30, y: 270 };
  invadersBullets: { x: number, y: number, vy: number }[] = [];
  invadersAliens: { x: number, y: number, vx: number, vy: number, label: string, width: 44, height: 18 }[] = [];
  invadersShipXSpeed = 0;

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.connectWebSocket();
      this.fetchGameState();
      window.addEventListener('keydown', this.keydownListener);
      window.addEventListener('keyup', this.keyupListener);
    }
  }

  ngOnDestroy() {
    if (this.ws) {
      this.ws.close();
    }
    if (isPlatformBrowser(this.platformId)) {
      window.removeEventListener('keydown', this.keydownListener);
      window.removeEventListener('keyup', this.keyupListener);
    }
    if (this.arcadeLoop) {
      cancelAnimationFrame(this.arcadeLoop);
    }
  }

  private connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/chat`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.serverStatus.set('Online (WebSocket Connected)');
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message' || data.type === 'achievement') {
          this.chatMessages.update((msgs) => [...msgs, data]);
          this.scrollToBottom();
        } else if (data.type === 'score_update') {
          this.ranking.update((ranks) => {
            const index = ranks.findIndex((r) => r.name === data.user);
            const newRanks = [...ranks];
            if (index !== -1) {
              newRanks[index] = { name: data.user, score: data.score };
            } else {
              newRanks.push({ name: data.user, score: data.score });
            }
            return newRanks.sort((a, b) => b.score - a.score);
          });
          if (data.user === 'Lucas Santos') {
            this.score.set(data.score);
          }
        }
      } catch (e) {
        console.error('Error parsing WS message', e);
      }
    };

    this.ws.onerror = (error) => {
       console.error('WebSocket Error:', error);
       this.serverStatus.set('Offline');
    };

    this.ws.onclose = () => {
      this.serverStatus.set('Offline');
      setTimeout(() => this.connectWebSocket(), 3000); // Reconnect
    };
  }

  sendMessage(event: Event) {
    event.preventDefault();
    if (!this.newMessage().trim() || !this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      user: 'LUCAS',
      text: this.newMessage().trim(),
      type: 'message'
    };

    this.ws.send(JSON.stringify(payload));
    this.newMessage.set('');
  }

  updateNewMessage(event: Event) {
    const input = event.target as HTMLInputElement;
    this.newMessage.set(input.value);
  }

  private scrollToBottom() {
    setTimeout(() => {
      const chatContainer = document.getElementById('chat-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 50);
  }

  // API Game calls
  fetchGameState() {
    if (!isPlatformBrowser(this.platformId)) return;
    fetch('/api/game/state')
      .then(res => res.json())
      .then(data => {
        this.updateState(data);
      })
      .catch(err => console.error('Error fetching game state:', err));
  }

  updateState(data: any) {
    this.currentPhase.set(data.phase);
    this.score.set(data.score);
    this.unlockedStages.set(data.unlockedStages);
    this.completedStages.set(data.completedStages);
    this.currentStage.set(data.currentStage);
    this.theoryRead.set(data.theoryRead);
    this.retryCount.set(data.retryCount);
    this.arcadeCompleted.set(false);
    
    // Stop any existing loops
    if (this.arcadeLoop) {
      cancelAnimationFrame(this.arcadeLoop);
      this.arcadeLoop = null;
    }

    // Initialize games if theory was read
    if (data.theoryRead) {
      if (data.currentStage === 1) setTimeout(() => this.initTargetGame(), 100);
      else if (data.currentStage === 2) setTimeout(() => this.initSnakeGame(), 100);
      else if (data.currentStage === 3) setTimeout(() => this.initDonkeyKongGame(), 100);
      else if (data.currentStage === 4) setTimeout(() => this.initPacketShooterGame(), 100);
      else if (data.currentStage === 5) setTimeout(() => this.initSpaceInvadersGame(), 100);
    }
    
    this.selectedOptionKey.set(null);
    this.feedbackActive.set(false);
  }

  selectStage(stage: number) {
    if (!this.unlockedStages().includes(stage)) return;
    fetch('/api/game/select-stage', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stage })
    })
      .then(res => res.json())
      .then(data => {
        this.updateState(data);
      })
      .catch(err => console.error('Error selecting stage:', err));
  }

  readTheory() {
    fetch('/api/game/read-theory', {
      method: 'POST'
    })
      .then(res => res.json())
      .then(data => {
        this.theoryRead.set(data.theoryRead);
        const stage = this.currentStage();
        if (stage === 1) setTimeout(() => this.initTargetGame(), 100);
        else if (stage === 2) setTimeout(() => this.initSnakeGame(), 100);
        else if (stage === 3) setTimeout(() => this.initDonkeyKongGame(), 100);
        else if (stage === 4) setTimeout(() => this.initPacketShooterGame(), 100);
        else if (stage === 5) setTimeout(() => this.initSpaceInvadersGame(), 100);
      })
      .catch(err => console.error('Error reading theory:', err));
  }

  selectOption(key: any) {
    this.selectedOptionKey.set(String(key));
  }

  submitAnswer() {
    const answer = this.selectedOptionKey();
    if (!answer) return;

    fetch('/api/game/answer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ answer })
    })
      .then(res => res.json())
      .then(data => {
        this.feedbackActive.set(true);
        this.feedbackIsCorrect.set(data.correct);
        this.correctAnswerToShow.set(data.correct_answer || answer);
        this.score.set(data.current_score);
        this.retryCount.set(data.retry_count || this.retryCount());
      })
      .catch(err => console.error('Error submitting answer:', err));
  }

  tryAgain() {
    this.feedbackActive.set(false);
    this.selectedOptionKey.set(null);
    this.fetchGameState();
  }

  nextQuestion() {
    fetch('/api/game/complete-phase', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
      .then(res => res.json())
      .then(data => {
        if (data.game_over) {
          this.gameOver.set(true);
          this.isSuccess.set(true);
        } else {
          this.updateState(data);
        }
      })
      .catch(err => console.error('Error completing phase:', err));
  }

  resetGame() {
    fetch('/api/game/reset', {
      method: 'POST'
    })
      .then(res => res.json())
      .then(() => {
        this.gameOver.set(false);
        this.isSuccess.set(false);
        this.fetchGameState();
      })
      .catch(err => console.error('Error resetting game:', err));
  }

  // Keyboard controls
  keydownListener = (e: KeyboardEvent) => {
    const stage = this.currentStage();
    if (!this.theoryRead() || this.arcadeGameOver()) return;

    if (stage === 2) {
      if (e.key === 'ArrowLeft' && this.snakeDir.x === 0) {
        this.snakeDir = { x: -20, y: 0 };
      } else if (e.key === 'ArrowRight' && this.snakeDir.x === 0) {
        this.snakeDir = { x: 20, y: 0 };
      } else if (e.key === 'ArrowUp' && this.snakeDir.y === 0) {
        this.snakeDir = { x: 0, y: -20 };
      } else if (e.key === 'ArrowDown' && this.snakeDir.y === 0) {
        this.snakeDir = { x: 0, y: 20 };
      }
    } else if (stage === 3) {
      if (e.key === 'ArrowLeft') {
        this.dkPlayer.vx = -3.5;
      } else if (e.key === 'ArrowRight') {
        this.dkPlayer.vx = 3.5;
      } else if (e.key === 'ArrowUp') {
        const onLadder = this.dkLadders.find(l => Math.abs(this.dkPlayer.x - l.x) < 18 && this.dkPlayer.y >= l.y2 - 12 && this.dkPlayer.y <= l.y1);
        if (onLadder) {
          this.dkPlayer.isClimbing = true;
          this.dkPlayer.vy = -2.5;
        }
      } else if (e.key === 'ArrowDown') {
        const onLadder = this.dkLadders.find(l => Math.abs(this.dkPlayer.x - l.x) < 18 && this.dkPlayer.y >= l.y2 && this.dkPlayer.y <= l.y1 - 10);
        if (onLadder) {
          this.dkPlayer.isClimbing = true;
          this.dkPlayer.vy = 2.5;
        }
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        if (!this.dkPlayer.isJumping && !this.dkPlayer.isClimbing) {
          this.dkPlayer.isJumping = true;
          this.dkPlayer.vy = -7.5;
        }
      }
    } else if (stage === 4) {
      if (e.key === 'ArrowLeft') {
        this.routerAngle = Math.max(-60, this.routerAngle - 5);
      } else if (e.key === 'ArrowRight') {
        this.routerAngle = Math.min(60, this.routerAngle + 5);
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this.shootRouterPacket();
      }
    } else if (stage === 5) {
      if (e.key === 'ArrowLeft') {
        this.invadersShipXSpeed = -4;
      } else if (e.key === 'ArrowRight') {
        this.invadersShipXSpeed = 4;
      } else if (e.key === ' ' || e.key === 'Spacebar') {
        e.preventDefault();
        this.shootInvaderBullet();
      }
    }
  };

  keyupListener = (e: KeyboardEvent) => {
    const stage = this.currentStage();
    if (stage === 3) {
      if (e.key === 'ArrowLeft' && this.dkPlayer.vx < 0) this.dkPlayer.vx = 0;
      if (e.key === 'ArrowRight' && this.dkPlayer.vx > 0) this.dkPlayer.vx = 0;
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && this.dkPlayer.isClimbing) this.dkPlayer.vy = 0;
    } else if (stage === 5) {
      if (e.key === 'ArrowLeft' && this.invadersShipXSpeed < 0) this.invadersShipXSpeed = 0;
      if (e.key === 'ArrowRight' && this.invadersShipXSpeed > 0) this.invadersShipXSpeed = 0;
    }
  };

  // ----------------------------------------------------
  // Stage 1: Tiro ao Alvo (Target Shooting)
  // ----------------------------------------------------
  initTargetGame() {
    this.arcadeGameOver.set(false);
    this.targetHits.set(0);
    this.spawnTargetQuestion();

    if (this.arcadeLoop) cancelAnimationFrame(this.arcadeLoop);
    const loop = () => {
      if (this.currentStage() !== 1 || this.arcadeGameOver() || !this.theoryRead()) return;
      this.updateTargetGame();
      this.drawTargetGame();
      this.arcadeLoop = requestAnimationFrame(loop);
    };
    this.arcadeLoop = requestAnimationFrame(loop);
  }

  spawnTargetQuestion() {
    this.currentTargetPromptIndex = Math.floor(Math.random() * this.targetPrompts.length);
    const correctLabel = this.targetPrompts[this.currentTargetPromptIndex].correct;
    const labels = ['Estrela', 'Barramento', 'Anel', 'Malha'];
    
    this.targets = labels.map((label, idx) => ({
      x: 50 + idx * 85 + Math.random() * 15,
      y: 90 + Math.random() * 80,
      vx: (Math.random() > 0.5 ? 1 : -1) * (1 + Math.random() * 1.5),
      label: label,
      correct: label === correctLabel,
      radius: 32
    }));
  }

  updateTargetGame() {
    for (let t of this.targets) {
      t.x += t.vx;
      if (t.x < t.radius || t.x > 400 - t.radius) {
        t.vx *= -1;
      }
    }
  }

  drawTargetGame() {
    const canvas = document.getElementById('targetCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(34, 211, 238, 0.04)';
    for (let x = 0; x < canvas.width; x += 40) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 40) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(this.targetPrompts[this.currentTargetPromptIndex].question, 200, 32);

    for (let t of this.targets) {
      // 1. Draw outer glowing boundary circle
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'; // Slate 900 background for bubble
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.6)'; // Accent border
      ctx.lineWidth = 1.5;
      ctx.fill();
      ctx.stroke();

      // 2. Draw specific topology diagram
      ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(34, 211, 238, 0.4)';
      ctx.fillStyle = '#22d3ee'; // Cyan nodes
      
      const centerY = t.y - 5; // offset diagram upwards to leave room for label

      if (t.label === 'Estrela') {
        const nodes = [
          { x: t.x, y: centerY }, // center
          { x: t.x - 12, y: centerY - 12 },
          { x: t.x + 12, y: centerY - 12 },
          { x: t.x - 12, y: centerY + 12 },
          { x: t.x + 12, y: centerY + 12 }
        ];
        // draw lines from center
        for (let i = 1; i < nodes.length; i++) {
          ctx.beginPath();
          ctx.moveTo(nodes[0].x, nodes[0].y);
          ctx.lineTo(nodes[i].x, nodes[i].y);
          ctx.stroke();
        }
        // draw dots
        for (let n of nodes) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (t.label === 'Barramento') {
        // trunk line
        ctx.beginPath();
        ctx.moveTo(t.x - 18, centerY);
        ctx.lineTo(t.x + 18, centerY);
        ctx.stroke();

        // drops and nodes
        const drops = [
          { x: t.x - 12, y: centerY + 10 },
          { x: t.x, y: centerY - 10 },
          { x: t.x + 12, y: centerY + 10 }
        ];
        for (let d of drops) {
          ctx.beginPath();
          ctx.moveTo(d.x, centerY);
          ctx.lineTo(d.x, d.y);
          ctx.stroke();
          
          ctx.beginPath();
          ctx.arc(d.x, d.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (t.label === 'Anel') {
        // ring line
        ctx.beginPath();
        ctx.arc(t.x, centerY, 12, 0, Math.PI * 2);
        ctx.stroke();

        // nodes on ring
        const angles = [0, Math.PI / 2, Math.PI, Math.PI * 1.5];
        for (let a of angles) {
          const nx = t.x + Math.cos(a) * 12;
          const ny = centerY + Math.sin(a) * 12;
          ctx.beginPath();
          ctx.arc(nx, ny, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      } else if (t.label === 'Malha') {
        // mesh vertices
        const nodes = [
          { x: t.x - 12, y: centerY - 12 },
          { x: t.x + 12, y: centerY - 12 },
          { x: t.x + 12, y: centerY + 12 },
          { x: t.x - 12, y: centerY + 12 }
        ];
        // connect all pairs
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            ctx.beginPath();
            ctx.moveTo(nodes[i].x, nodes[i].y);
            ctx.lineTo(nodes[j].x, nodes[j].y);
            ctx.stroke();
          }
        }
        // draw nodes
        for (let n of nodes) {
          ctx.beginPath();
          ctx.arc(n.x, n.y, 2.5, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // 3. Draw text label tag just below diagram inside the bubble
      ctx.fillStyle = 'rgba(2, 6, 23, 0.85)';
      ctx.fillRect(t.x - t.radius + 4, t.y + 12, (t.radius - 4) * 2, 12);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 8px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(t.label, t.x, t.y + 21);
    }

    ctx.fillStyle = '#22d3ee';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Meta: ${this.targetHits()} / 5 acertos`, 15, canvas.height - 15);
  }

  handleCanvasClick(e: MouseEvent) {
    const canvas = e.target as HTMLCanvasElement;
    if (!canvas || this.currentStage() !== 1 || !this.theoryRead() || this.arcadeGameOver()) return;
    const rect = canvas.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickY = e.clientY - rect.top;

    for (let t of this.targets) {
      const dist = Math.hypot(clickX - t.x, clickY - t.y);
      if (dist <= t.radius) {
        if (t.correct) {
          const nextHits = this.targetHits() + 1;
          this.targetHits.set(nextHits);
          fetch('/api/game/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 20, eventName: 'acertou a topologia no alvo' })
          })
            .then(res => res.json())
            .then(data => this.score.set(data.score));
          
          if (nextHits >= 5) {
            if (this.currentPhase() && this.currentPhase().question) {
              this.arcadeCompleted.set(true);
              if (this.arcadeLoop) cancelAnimationFrame(this.arcadeLoop);
            } else {
              this.nextQuestion();
            }
            return;
          }
          this.spawnTargetQuestion();
        } else {
          fetch('/api/game/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: -10, eventName: 'errou a topologia no alvo' })
          })
            .then(res => res.json())
            .then(data => this.score.set(data.score));
          this.spawnTargetQuestion();
        }
        break;
      }
    }
  }

  // ----------------------------------------------------
  // Stage 2: Aladdin Carpet (Snake - Cabeamento)
  // ----------------------------------------------------
  initSnakeGame() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.arcadeGameOver.set(false);
    this.snakeTargetIndex.set(0);
    this.snake = [
      { x: 100, y: 100 },
      { x: 80, y: 100 },
      { x: 60, y: 100 }
    ];
    this.snakeDir = { x: 20, y: 0 };
    this.spawnSnakeFood();

    if (this.arcadeLoop) cancelAnimationFrame(this.arcadeLoop);
    let lastTime = 0;
    const loop = (time: number) => {
      if (this.currentStage() !== 2 || this.arcadeGameOver() || !this.theoryRead()) return;
      if (!lastTime) lastTime = time;
      if (time - lastTime > 160) {
        this.updateSnake();
        this.drawSnake();
        lastTime = time;
      }
      this.arcadeLoop = requestAnimationFrame(loop);
    };
    this.arcadeLoop = requestAnimationFrame(loop);
  }

  spawnSnakeFood() {
    const canvas = document.getElementById('snakeCanvas') as HTMLCanvasElement;
    if (!canvas) return;

    const rx = Math.floor(Math.random() * (canvas.width / 20)) * 20;
    const ry = Math.floor(Math.random() * (canvas.height / 20)) * 20;
    const currentWire = this.t568bOrder[this.snakeTargetIndex()];
    this.snakeFood = [{ x: rx, y: ry, color: currentWire, correct: true }];

    const dx = Math.floor(Math.random() * (canvas.width / 20)) * 20;
    const dy = Math.floor(Math.random() * (canvas.height / 20)) * 20;
    const wrongColor = this.t568bOrder[(this.snakeTargetIndex() + 1) % 8];
    this.snakeFood.push({ x: dx, y: dy, color: wrongColor, correct: false });
  }

  updateSnake() {
    if (this.snake.length === 0) return;
    const head = { x: this.snake[0].x + this.snakeDir.x, y: this.snake[0].y + this.snakeDir.y };

    if (head.x < 0 || head.x >= 400 || head.y < 0 || head.y >= 300) {
      this.arcadeGameOver.set(true);
      return;
    }

    for (let segment of this.snake) {
      if (head.x === segment.x && head.y === segment.y) {
        this.arcadeGameOver.set(true);
        return;
      }
    }

    this.snake.unshift(head);

    let ate = false;
    for (let i = 0; i < this.snakeFood.length; i++) {
      const food = this.snakeFood[i];
      if (head.x === food.x && head.y === food.y) {
        if (food.correct) {
          const nextIndex = this.snakeTargetIndex() + 1;
          this.snakeTargetIndex.set(nextIndex);
          
          fetch('/api/game/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 30, eventName: `conectou o fio ${food.color}` })
          })
            .then(res => res.json())
            .then(data => this.score.set(data.score));

          ate = true;
          if (nextIndex >= 8) {
            this.nextQuestion();
            return;
          }
          this.spawnSnakeFood();
        } else {
          fetch('/api/game/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: -15, eventName: `errou a cor do padrão T568B (${food.color})` })
          })
            .then(res => res.json())
            .then(data => this.score.set(data.score));
          this.spawnSnakeFood();
        }
        break;
      }
    }

    if (!ate) {
      this.snake.pop();
    }
  }

  drawSnake() {
    const canvas = document.getElementById('snakeCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(255,255,255,0.02)';
    for (let x = 0; x < canvas.width; x += 20) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += 20) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    for (let food of this.snakeFood) {
      ctx.fillStyle = food.correct ? '#10b981' : '#ef4444';
      ctx.fillRect(food.x + 2, food.y + 2, 16, 16);
      ctx.fillStyle = '#ffffff';
      ctx.font = '6px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(food.color.substring(0, 5), food.x + 10, food.y + 12);
    }

    this.snake.forEach((segment, index) => {
      ctx.fillStyle = index === 0 ? '#eab308' : '#3b82f6';
      ctx.fillRect(segment.x + 1, segment.y + 1, 18, 18);
      if (index === 0) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(segment.x + 4, segment.y + 5, 3, 3);
        ctx.fillRect(segment.x + 12, segment.y + 5, 3, 3);
      }
    });
  }

  // ----------------------------------------------------
  // Stage 3: Subnet Donkey Kong (IP barrel avoidance)
  // ----------------------------------------------------
  initDonkeyKongGame() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.arcadeGameOver.set(false);
    this.dkScore.set(0);
    this.dkLives.set(3);
    this.dkPlayer = { x: 50, y: 226, vx: 0, vy: 0, isJumping: false, isClimbing: false, width: 16, height: 24 };
    this.dkBarrels = [];

    if (this.arcadeLoop) cancelAnimationFrame(this.arcadeLoop);
    const loop = () => {
      if (this.currentStage() !== 3 || this.arcadeGameOver() || !this.theoryRead()) return;
      this.updateDonkeyKong();
      this.drawDonkeyKong();
      this.arcadeLoop = requestAnimationFrame(loop);
    };
    this.arcadeLoop = requestAnimationFrame(loop);
  }

  updateDonkeyKong() {
    const now = Date.now();
    if (now - this.lastBarrelSpawnTime > 2600) {
      this.lastBarrelSpawnTime = now;
      const isVal = Math.random() > 0.45;
      const label = isVal 
        ? `192.168.10.${Math.floor(Math.random() * 253) + 1}`
        : (Math.random() > 0.5 ? '192.168.10.255' : '192.168.12.10');
      
      this.dkBarrels.push({
        x: 350,
        y: 79,
        vx: -1.6,
        label: label,
        valid: isVal,
        width: 30,
        height: 16
      });
    }

    this.dkPlayer.x += this.dkPlayer.vx;
    if (this.dkPlayer.x < 0) this.dkPlayer.x = 0;
    if (this.dkPlayer.x > 384) this.dkPlayer.x = 384;

    if (this.dkPlayer.isClimbing) {
      this.dkPlayer.y += this.dkPlayer.vy;
      const nearLadder = this.dkLadders.find(l => Math.abs(this.dkPlayer.x - l.x) < 18);
      if (!nearLadder || this.dkPlayer.y < nearLadder.y2 - 12 || this.dkPlayer.y > nearLadder.y1) {
        this.dkPlayer.isClimbing = false;
        this.dkPlayer.vy = 0;
      }
    } else {
      this.dkPlayer.vy += 0.45; // gravity
      this.dkPlayer.y += this.dkPlayer.vy;

      let onPlatform = false;
      for (let plat of this.dkPlatforms) {
        if (this.dkPlayer.x + this.dkPlayer.width >= plat.x && this.dkPlayer.x <= plat.x + plat.w) {
          const feetY = this.dkPlayer.y + this.dkPlayer.height;
          if (feetY >= plat.y && feetY - this.dkPlayer.vy <= plat.y + 6) {
            this.dkPlayer.y = plat.y - this.dkPlayer.height;
            this.dkPlayer.vy = 0;
            this.dkPlayer.isJumping = false;
            onPlatform = true;
            break;
          }
        }
      }
    }

    for (let i = this.dkBarrels.length - 1; i >= 0; i--) {
      let b = this.dkBarrels[i];
      b.x += b.vx;

      let bCurrentPlatY = 250;
      if (b.y < 95) bCurrentPlatY = 95;
      else if (b.y < 170) bCurrentPlatY = 170;

      if (b.x < 10 && bCurrentPlatY === 95) {
        b.y = 154;
        b.vx = 1.6;
      } else if (b.x > 370 && bCurrentPlatY === 170) {
        b.y = 234;
        b.vx = -1.6;
      }

      const px = this.dkPlayer.x + this.dkPlayer.width / 2;
      const py = this.dkPlayer.y + this.dkPlayer.height / 2;
      const bx = b.x + b.width / 2;
      const by = b.y + b.height / 2;
      const dist = Math.hypot(px - bx, py - by);

      if (dist < 18) {
        if (b.valid) {
          const nextScore = this.dkScore() + 1;
          this.dkScore.set(nextScore);
          fetch('/api/game/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 50, eventName: `coletou IP host válido ${b.label}` })
          })
            .then(res => res.json())
            .then(data => this.score.set(data.score));
          
          this.dkBarrels.splice(i, 1);
          if (nextScore >= 3 && this.dkPlayer.y + this.dkPlayer.height <= 96) {
            this.nextQuestion();
            return;
          }
          continue;
        } else {
          const nextLives = this.dkLives() - 1;
          this.dkLives.set(nextLives);
          fetch('/api/game/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: -20, eventName: `colidiu com IP inválido/broadcast (${b.label})` })
          })
            .then(res => res.json())
            .then(data => this.score.set(data.score));

          this.dkPlayer.x = 50;
          this.dkPlayer.y = 226;
          this.dkPlayer.vx = 0;
          this.dkPlayer.vy = 0;
          this.dkPlayer.isClimbing = false;
          this.dkPlayer.isJumping = false;
          this.dkBarrels = [];

          if (nextLives <= 0) {
            this.arcadeGameOver.set(true);
          }
          break;
        }
      }

      if (b.x < -40 || b.x > 440) {
        this.dkBarrels.splice(i, 1);
      }
    }

    if (this.dkPlayer.y + this.dkPlayer.height <= 96 && this.dkScore() >= 3) {
      this.nextQuestion();
    }
  }

  drawDonkeyKong() {
    const canvas = document.getElementById('donkeyKongCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = '#ef4444';
    for (let p of this.dkPlatforms) {
      ctx.fillRect(p.x, p.y, p.w, 6);
    }

    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 2;
    for (let l of this.dkLadders) {
      ctx.beginPath();
      ctx.moveTo(l.x, l.y1);
      ctx.lineTo(l.x, l.y2);
      ctx.moveTo(l.x + l.width, l.y1);
      ctx.lineTo(l.x + l.width, l.y2);
      ctx.stroke();

      for (let ry = l.y2; ry <= l.y1; ry += 10) {
        ctx.beginPath();
        ctx.moveTo(l.x, ry);
        ctx.lineTo(l.x + l.width, ry);
        ctx.stroke();
      }
    }

    ctx.fillStyle = '#ec4899';
    ctx.fillRect(330, 50, 30, 38);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 8px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('HACKER', 345, 42);

    ctx.fillStyle = '#a855f7';
    ctx.fillRect(40, 60, 20, 28);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 6px monospace';
    ctx.fillText('BANDA LARGA', 50, 54);

    for (let b of this.dkBarrels) {
      ctx.fillStyle = b.valid ? '#10b981' : '#b45309';
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '6px monospace';
      ctx.fillText(b.label.split('.').slice(2).join('.'), b.x + 15, b.y + 10);
    }

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(this.dkPlayer.x, this.dkPlayer.y, this.dkPlayer.width, this.dkPlayer.height);

    ctx.fillStyle = '#22d3ee';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Host IPs: ${this.dkScore()} / 3`, 15, 20);
    ctx.fillText(`Vidas: ${this.dkLives()}`, 320, 20);
  }

  // ----------------------------------------------------
  // Stage 4: Packet Shooter (Routing Shooter)
  // ----------------------------------------------------
  initPacketShooterGame() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.arcadeGameOver.set(false);
    this.routerHits.set(0);
    this.routerAngle = 0;
    this.routerLaser = null;
    this.routerBuckets = [
      { x: 30, y: 55, vx: 1.2, name: 'LAN', range: '192.168.x.x', width: 80, height: 25 },
      { x: 160, y: 55, vx: -1.0, name: 'WAN', range: '8.8.x.x', width: 80, height: 25 },
      { x: 280, y: 55, vx: 0.8, name: 'VPN', range: '10.x.x.x', width: 80, height: 25 }
    ];
    this.spawnNextRouterPacket();

    if (this.arcadeLoop) cancelAnimationFrame(this.arcadeLoop);
    const loop = () => {
      if (this.currentStage() !== 4 || this.arcadeGameOver() || !this.theoryRead()) return;
      this.updatePacketShooter();
      this.drawPacketShooter();
      this.arcadeLoop = requestAnimationFrame(loop);
    };
    this.arcadeLoop = requestAnimationFrame(loop);
  }

  spawnNextRouterPacket() {
    const types = [
      { ip: '192.168.10.50', target: 'LAN' },
      { ip: '8.8.8.8', target: 'WAN' },
      { ip: '10.0.0.12', target: 'VPN' },
      { ip: '192.168.1.1', target: 'LAN' },
      { ip: '8.8.4.4', target: 'WAN' },
      { ip: '10.250.0.1', target: 'VPN' }
    ];
    const item = types[Math.floor(Math.random() * types.length)];
    this.routerCurrentPacketIP = item.ip;
    this.routerCurrentPacketTarget = item.target;
  }

  shootRouterPacket() {
    if (this.routerLaser) return;
    const angleRad = (this.routerAngle * Math.PI) / 180;
    const speed = 7.5;
    this.routerLaser = {
      x: 200,
      y: 265,
      vx: Math.sin(angleRad) * speed,
      vy: -Math.cos(angleRad) * speed,
      ip: this.routerCurrentPacketIP,
      validBucket: this.routerCurrentPacketTarget
    };
  }

  updatePacketShooter() {
    for (let b of this.routerBuckets) {
      b.x += b.vx;
      if (b.x < 10 || b.x > 400 - b.width - 10) {
        b.vx *= -1;
      }
    }

    if (this.routerLaser) {
      this.routerLaser.x += this.routerLaser.vx;
      this.routerLaser.y += this.routerLaser.vy;

      if (this.routerLaser.y < 0 || this.routerLaser.x < 0 || this.routerLaser.x > 400) {
        this.routerLaser = null;
        this.spawnNextRouterPacket();
        return;
      }

      for (let b of this.routerBuckets) {
        if (this.routerLaser.x >= b.x && this.routerLaser.x <= b.x + b.width &&
            this.routerLaser.y >= b.y && this.routerLaser.y <= b.y + b.height) {
          
          if (b.name === this.routerLaser.validBucket) {
            const nextHits = this.routerHits() + 1;
            this.routerHits.set(nextHits);
            fetch('/api/game/score', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: 30, eventName: `roteou IP ${this.routerLaser.ip} para gateway ${b.name}` })
            })
              .then(res => res.json())
              .then(data => this.score.set(data.score));

            if (nextHits >= 5) {
              if (this.currentPhase() && this.currentPhase().question) {
                this.arcadeCompleted.set(true);
                if (this.arcadeLoop) cancelAnimationFrame(this.arcadeLoop);
              } else {
                this.nextQuestion();
              }
              return;
            }
          } else {
            fetch('/api/game/score', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ amount: -15, eventName: `roteou IP ${this.routerLaser.ip} incorretamente` })
            })
              .then(res => res.json())
              .then(data => this.score.set(data.score));
          }

          this.routerLaser = null;
          this.spawnNextRouterPacket();
          break;
        }
      }
    }
  }

  drawPacketShooter() {
    const canvas = document.getElementById('routerCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    for (let b of this.routerBuckets) {
      ctx.fillStyle = 'rgba(34, 211, 238, 0.1)';
      ctx.strokeStyle = '#22d3ee';
      ctx.lineWidth = 1.5;
      ctx.fillRect(b.x, b.y, b.width, b.height);
      ctx.strokeRect(b.x, b.y, b.width, b.height);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(b.name, b.x + b.width / 2, b.y + 11);
      ctx.font = '6px monospace';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(b.range, b.x + b.width / 2, b.y + 20);
    }

    ctx.fillStyle = '#475569';
    ctx.beginPath();
    ctx.arc(200, 280, 20, Math.PI, 0);
    ctx.fill();

    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(200, 280);
    const angleRad = (this.routerAngle * Math.PI) / 180;
    ctx.lineTo(200 + Math.sin(angleRad) * 35, 280 - Math.cos(angleRad) * 35);
    ctx.stroke();

    if (this.routerLaser) {
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(this.routerLaser.x, this.routerLaser.y, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.font = '6px monospace';
      ctx.fillStyle = '#ffffff';
      ctx.fillText(this.routerLaser.ip.split('.').slice(0,2).join('.'), this.routerLaser.x, this.routerLaser.y - 8);
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`IP Atual: ${this.routerCurrentPacketIP}`, 15, 20);
    ctx.fillText(`Objetivo: ${this.routerHits()} / 5 acertos`, 15, canvas.height - 15);
    ctx.font = '7px monospace';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('MIRAR (← →) | DISPARAR (ESPAÇO)', 180, canvas.height - 15);
  }

  // ----------------------------------------------------
  // Stage 5: Firewall Space Invaders
  // ----------------------------------------------------
  initSpaceInvadersGame() {
    if (!isPlatformBrowser(this.platformId)) return;
    this.arcadeGameOver.set(false);
    this.invadersHits.set(0);
    this.invaderShield.set(3);
    this.invadersShip = { x: 200, width: 30, y: 270 };
    this.invadersBullets = [];
    this.invadersAliens = [];
    this.spawnInvadersFleet();

    if (this.arcadeLoop) cancelAnimationFrame(this.arcadeLoop);
    const loop = () => {
      if (this.currentStage() !== 5 || this.arcadeGameOver() || !this.theoryRead()) return;
      this.updateSpaceInvaders();
      this.drawSpaceInvaders();
      this.arcadeLoop = requestAnimationFrame(loop);
    };
    this.arcadeLoop = requestAnimationFrame(loop);
  }

  spawnInvadersFleet() {
    const labels = ['Trojan', 'DDoS', 'Worm', 'Virus', 'Spyware'];
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < 5; col++) {
        this.invadersAliens.push({
          x: 40 + col * 60,
          y: 45 + row * 28,
          vx: 1.0,
          vy: 0,
          label: labels[(row * 5 + col) % labels.length],
          width: 44,
          height: 18
        });
      }
    }
  }

  shootInvaderBullet() {
    this.invadersBullets.push({
      x: this.invadersShip.x,
      y: this.invadersShip.y - 8,
      vy: -5.5
    });
  }

  updateSpaceInvaders() {
    this.invadersShip.x += this.invadersShipXSpeed;
    if (this.invadersShip.x < 15) this.invadersShip.x = 15;
    if (this.invadersShip.x > 385) this.invadersShip.x = 385;

    for (let i = this.invadersBullets.length - 1; i >= 0; i--) {
      let b = this.invadersBullets[i];
      b.y += b.vy;
      if (b.y < 0) {
        this.invadersBullets.splice(i, 1);
      }
    }

    let shiftDown = false;
    for (let a of this.invadersAliens) {
      a.x += a.vx;
      if (a.x < 10 || a.x > 400 - a.width - 10) {
        shiftDown = true;
      }
    }

    if (shiftDown) {
      for (let a of this.invadersAliens) {
        a.vx *= -1;
        a.y += 15;
      }
    }

    for (let bi = this.invadersBullets.length - 1; bi >= 0; bi--) {
      let bullet = this.invadersBullets[bi];
      let hit = false;
      for (let ai = this.invadersAliens.length - 1; ai >= 0; ai--) {
        let alien = this.invadersAliens[ai];
        if (bullet.x >= alien.x && bullet.x <= alien.x + alien.width &&
            bullet.y >= alien.y && bullet.y <= alien.y + alien.height) {
          
          const nextHits = this.invadersHits() + 1;
          this.invadersHits.set(nextHits);
          fetch('/api/game/score', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount: 15, eventName: `bloqueou malware ${alien.label} no firewall` })
          })
            .then(res => res.json())
            .then(data => this.score.set(data.score));

          this.invadersAliens.splice(ai, 1);
          hit = true;

          if (nextHits >= 15) {
            if (this.currentPhase() && this.currentPhase().question) {
              this.arcadeCompleted.set(true);
              if (this.arcadeLoop) cancelAnimationFrame(this.arcadeLoop);
            } else {
              this.nextQuestion();
            }
            return;
          }
          break;
        }
      }
      if (hit) {
        this.invadersBullets.splice(bi, 1);
      }
    }

    for (let a of this.invadersAliens) {
      if (a.y + a.height >= 240) {
        const nextShield = this.invaderShield() - 1;
        this.invaderShield.set(nextShield);
        
        fetch('/api/game/score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: -30, eventName: 'teve rede invadida por malware' })
        })
          .then(res => res.json())
          .then(data => this.score.set(data.score));

        this.invadersAliens = [];
        this.invadersBullets = [];
        this.spawnInvadersFleet();

        if (nextShield <= 0) {
          this.arcadeGameOver.set(true);
        }
        break;
      }
    }

    if (this.invadersAliens.length === 0) {
      this.spawnInvadersFleet();
    }
  }

  drawSpaceInvaders() {
    const canvas = document.getElementById('spaceInvadersCanvas') as HTMLCanvasElement;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 240);
    ctx.lineTo(400, 240);
    ctx.stroke();

    ctx.fillStyle = '#22d3ee';
    ctx.fillRect(this.invadersShip.x - 15, this.invadersShip.y, this.invadersShip.width, 15);
    ctx.fillRect(this.invadersShip.x - 4, this.invadersShip.y - 6, 8, 6);

    ctx.fillStyle = '#fbbf24';
    for (let b of this.invadersBullets) {
      ctx.fillRect(b.x - 1.5, b.y, 3, 8);
    }

    for (let a of this.invadersAliens) {
      ctx.fillStyle = '#ec4899';
      ctx.fillRect(a.x, a.y, a.width, a.height);
      ctx.fillStyle = '#ffffff';
      ctx.font = '7px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(a.label, a.x + a.width / 2, a.y + 11);
    }

    ctx.fillStyle = '#22d3ee';
    ctx.font = '9px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`Bloqueios: ${this.invadersHits()} / 15`, 15, 20);
    ctx.fillText(`Escudo Firewall: ${this.invaderShield()}`, 280, 20);
  }
}
