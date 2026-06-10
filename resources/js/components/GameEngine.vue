<template>
  <div class="netquest-container">
    <!-- Header: Stats and 5-Hour Timer -->
    <header class="game-header">
      <div class="brand">
        <span class="brand-glow">NetQuest</span>
        <span class="sub-brand">UC1 Arcade Edition</span>
      </div>

      <div class="stats-panel">
        <div class="stat-card">
          <span class="stat-label">SCORE</span>
          <span class="stat-value text-glowing" :class="{ 'pulse-green': scoreUpdated }">{{ score }} pts</span>
        </div>

        <div class="stat-card timer-card" :class="{ 'timer-warning': timerSeconds < 1800 }">
          <span class="stat-label">TEMPO RESTANTE</span>
          <span class="stat-value font-mono">{{ formatTime(timerSeconds) }}</span>
          <div class="timer-progress-bar" :style="{ width: (timerSeconds / 18000) * 100 + '%' }"></div>
        </div>
      </div>
    </header>

    <!-- Phase Track Navigation -->
    <nav class="phase-navigation">
      <div 
        v-for="p in phasesList" 
        :key="p.id" 
        class="phase-tab"
        :class="{ 
          'active': currentPhase && currentPhase.order === p.order,
          'completed': currentPhase && p.order < currentPhase.order
        }"
      >
        <div class="phase-number">{{ p.order }}</div>
        <div class="phase-info">
          <span class="phase-name">{{ p.name }}</span>
          <span class="phase-mode-badge" v-if="p.order === 2">Arcade: Snake</span>
          <span class="phase-mode-badge" v-else-if="p.order === 3">Arcade: Pac-man</span>
          <span class="phase-mode-badge" v-else>Interactive Simulator</span>
        </div>
      </div>
    </nav>

    <!-- Main Game Space -->
    <main class="game-body">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Carregando ambiente virtual de rede...</p>
      </div>

      <!-- Game Over State (Timeout or Complete) -->
      <div v-else-if="gameOver" class="status-screen card-glass">
        <div class="status-icon" :class="isSuccess ? 'icon-success' : 'icon-fail'">
          {{ isSuccess ? '🏆' : '⏰' }}
        </div>
        <h2 class="status-title">{{ isSuccess ? 'Certificação Concluída!' : 'Janela de Tempo Esgotada!' }}</h2>
        <p class="status-description">
          {{ isSuccess ? 'Parabéns! Você planejou, cabeou, endereçou e validou a infraestrutura local com sucesso.' : 'Tempo limite de 5 horas excedido.' }}
        </p>
        <div class="final-score-card">
          <span class="final-label">Pontuação Final</span>
          <span class="final-value">{{ score }} pts</span>
        </div>
        <button class="btn-primary" @click="restartGame">Reiniciar Simulação</button>
      </div>

      <!-- Phase Play View -->
      <div v-else-if="currentPhase" class="play-grid">
        <!-- Sidebar: Instructions -->
        <section class="instructions-sidebar card-glass">
          <div class="sidebar-header">
            <span class="badge">Fase {{ currentPhase.order }}</span>
            <h3>{{ currentPhase.name }}</h3>
          </div>
          <p class="phase-description">{{ currentPhase.description }}</p>
          
          <div class="network-diagram-placeholder">
            <!-- Phase 2 Custom Instructions (Snake) -->
            <div v-if="currentPhase.order === 2" class="arcade-instructions">
              <span class="arcade-title">🎮 CABLING SNAKE</span>
              <p>Colete os conectores e fios na ordem exata do padrão <strong>T568B</strong> para crimpar o cabo de rede:</p>
              <ol class="wiring-order">
                <li v-for="(color, index) in t568bOrder" :key="index" :class="{ 'current-wiring-target': index === snakeTargetIndex, 'wiring-done': index < snakeTargetIndex }">
                  {{ color }}
                </li>
              </ol>
              <div class="controls-hint">Use as setas do teclado (← ↑ → ↓) para controlar a crimpagem.</div>
            </div>

            <!-- Phase 3 Custom Instructions (Pac-man) -->
            <div v-else-if="currentPhase.order === 3" class="arcade-instructions">
              <span class="arcade-title">🎮 SUBNET PAC-MAN</span>
              <p>Colete apenas os IPs válidos para a subrede: <strong>192.168.10.0/24</strong></p>
              <p>Evite os IPs de rede, broadcast ou subredes erradas, e fuja dos fantasmas de vírus!</p>
              <div class="subnet-targets">
                <div class="target-ip valid">Válidos: 192.168.10.1 a 192.168.10.254</div>
                <div class="target-ip invalid">Inválidos: 192.168.10.0, 192.168.10.255, 192.168.11.x</div>
              </div>
              <div class="controls-hint">Use as setas do teclado (← ↑ → ↓) para guiar o pacote.</div>
            </div>

            <div v-else class="diagram-grid">
              <div class="node active-node">Servidor</div>
              <div class="link-line"></div>
              <div class="node">Switch</div>
              <div class="link-line"></div>
              <div class="node">Hosts</div>
            </div>
            <p v-if="currentPhase.order !== 2 && currentPhase.order !== 3" class="diagram-caption">Topologia lógica sob análise</p>
          </div>
        </section>

        <!-- Question Area / Arcade Area -->
        <section class="question-container card-glass">
          <!-- Arcade Stage: Snake (Phase 2) -->
          <div v-if="currentPhase.order === 2" class="arcade-wrapper">
            <h4 class="arcade-stage-title">Crimpar Cabo RJ-45 (Padrão T568B)</h4>
            <div class="canvas-container">
              <canvas ref="snakeCanvas" width="400" height="300" class="arcade-canvas"></canvas>
              <div v-if="arcadeGameOver" class="arcade-overlay">
                <p class="overlay-msg">Cabo Rompido! (Colisão)</p>
                <button class="btn-primary" @click="initSnakeGame">Tentar Novamente</button>
              </div>
            </div>
            <div class="arcade-status">
              <span>Fios Crimpadados: <strong>{{ snakeTargetIndex }} / 8</strong></span>
              <span>Alvo Atual: <strong class="target-highlight">{{ t568bOrder[snakeTargetIndex] }}</strong></span>
            </div>
          </div>

          <!-- Arcade Stage: Pacman (Phase 3) -->
          <div v-else-if="currentPhase.order === 3" class="arcade-wrapper">
            <h4 class="arcade-stage-title">Filtrar Endereçamento IP na Subrede</h4>
            <div class="canvas-container">
              <canvas ref="pacmanCanvas" width="400" height="300" class="arcade-canvas"></canvas>
              <div v-if="arcadeGameOver" class="arcade-overlay">
                <p class="overlay-msg">Pacote Corrompido por Malware!</p>
                <button class="btn-primary" @click="initPacmanGame">Tentar Novamente</button>
              </div>
            </div>
            <div class="arcade-status">
              <span>IPs Coletados: <strong>{{ pacmanCollectedCount }} / 5</strong></span>
              <span>Segurança: <strong :class="pacmanLives > 1 ? 'text-green' : 'text-red'">{{ pacmanLives }} Integridade</strong></span>
            </div>
          </div>

          <!-- Question Simulator Stage (Phases 1 & 4) -->
          <div v-else-if="currentQuestion" class="question-wrapper">
            <div class="question-meta">
              <span class="question-index">Questão {{ activeQuestionIndex + 1 }} de {{ currentPhase.questions.length }}</span>
              <div class="points-badge">
                <span class="pts-plus">+{{ currentQuestion.points }} pts</span>
                <span class="pts-minus">-{{ currentQuestion.penalty }} pts</span>
              </div>
            </div>

            <h4 class="question-title">{{ currentQuestion.title }}</h4>
            <p class="question-content">{{ currentQuestion.content }}</p>

            <div class="options-grid">
              <button 
                v-for="(optionText, optionKey) in currentQuestion.options" 
                :key="optionKey"
                class="option-btn"
                :class="getOptionClass(optionKey)"
                :disabled="feedbackActive"
                @click="selectOption(optionKey)"
              >
                <span class="option-letter">{{ optionKey }}</span>
                <span class="option-text">{{ optionText }}</span>
              </button>
            </div>

            <div v-if="feedbackActive" class="feedback-banner" :class="feedbackIsCorrect ? 'success-banner' : 'error-banner'">
              <p v-if="feedbackIsCorrect">
                <strong>Correto!</strong> +{{ currentQuestion.points }} pontos adicionados ao painel.
              </p>
              <p v-else>
                <strong>Incorreto!</strong> Penalidade de -{{ currentQuestion.penalty }} pontos. Resposta correta: <strong>{{ correctAnswerToShow }}</strong>
              </p>
            </div>

            <div class="actions-footer">
              <button 
                v-if="!feedbackActive" 
                class="btn-primary" 
                :disabled="!selectedOptionKey"
                @click="submitAnswer"
              >
                Confirmar Escolha
              </button>
              <button 
                v-else
                class="btn-primary btn-next" 
                @click="nextQuestion"
              >
                {{ isLastQuestionOfPhase ? 'Concluir Fase' : 'Próxima Questão' }}
              </button>
            </div>
          </div>

          <div v-else class="all-answered-state">
            <p>Configurações validadas. Avance para o próximo estágio de infraestrutura.</p>
            <button class="btn-primary" @click="advancePhase">Avançar de Estágio</button>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>

<script>
export default {
  name: 'GameEngine',
  data() {
    return {
      userId: 1,
      loading: true,
      gameOver: false,
      isSuccess: false,
      score: 0,
      timerSeconds: 18000, // 5 Horas (5 * 3600)
      timerInterval: null,
      scoreUpdated: false,
      
      phasesList: [
        { id: 1, order: 1, name: 'Planejamento' },
        { id: 2, order: 2, name: 'Infraestrutura (Snake)' },
        { id: 3, order: 3, name: 'Lógica (Pac-man)' },
        { id: 4, order: 4, name: 'Validação' }
      ],
      currentPhase: null,
      activeQuestionIndex: 0,
      selectedOptionKey: null,
      
      feedbackActive: false,
      feedbackIsCorrect: false,
      correctAnswerToShow: '',
      questionTimeStarted: null,

      // Arcade: Shared State
      arcadeGameOver: false,
      arcadeLoop: null,

      // Arcade: Snake variables
      t568bOrder: [
        'Branco-Laranja',
        'Laranja',
        'Branco-Verde',
        'Azul',
        'Branco-Azul',
        'Verde',
        'Branco-Marrom',
        'Marrom'
      ],
      snakeTargetIndex: 0,
      snake: [],
      snakeDir: { x: 20, y: 0 },
      snakeFood: [],

      // Arcade: Pacman variables
      pacman: { x: 20, y: 20, dx: 0, dy: 0 },
      pacmanCollectedCount: 0,
      pacmanLives: 3,
      pacmanItems: [],
      pacmanGhosts: [],
      pacmanMaze: [
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
        [1,0,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
        [1,0,1,1,0,1,0,1,0,1,0,1,1,0,1,0,1,1,0,1],
        [1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,1,1,0,1,1,0,1,0,1,1,0,1,1,0,1,1,1,0,1],
        [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,1,1,0,1,1,0,1,0,1,1,0,1,1,0,1,1,1,0,1],
        [1,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,1],
        [1,0,1,1,0,1,0,1,0,1,0,1,1,0,1,0,1,1,0,1],
        [1,0,0,0,0,1,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
        [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
      ]
    };
  },
  computed: {
    currentQuestion() {
      if (this.currentPhase && this.currentPhase.questions) {
        return this.currentPhase.questions[this.activeQuestionIndex];
      }
      return null;
    },
    isLastQuestionOfPhase() {
      if (this.currentPhase && this.currentPhase.questions) {
        return this.activeQuestionIndex === this.currentPhase.questions.length - 1;
      }
      return true;
    }
  },
  watch: {
    currentPhase(newPhase) {
      if (newPhase) {
        this.$nextTick(() => {
          if (newPhase.order === 2) {
            this.initSnakeGame();
          } else if (newPhase.order === 3) {
            this.initPacmanGame();
          }
        });
      }
    }
  },
  mounted() {
    this.fetchGameState();
    this.startGlobalTimer();
    window.addEventListener('keydown', this.handleKeyDown);
  },
  beforeUnmount() {
    clearInterval(this.timerInterval);
    cancelAnimationFrame(this.arcadeLoop);
    window.removeEventListener('keydown', this.handleKeyDown);
  },
  methods: {
    async fetchGameState() {
      this.loading = true;
      try {
        const response = await fetch(`/api/game/state?user_id=${this.userId}`);
        const data = await response.json();
        
        if (response.ok) {
          this.currentPhase = data.phase;
          this.score = data.score;
          this.activeQuestionIndex = 0;
          this.resetFeedback();
          this.questionTimeStarted = Date.now();
        }
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
    },
    startGlobalTimer() {
      this.timerInterval = setInterval(() => {
        if (this.timerSeconds > 0) {
          this.timerSeconds--;
        } else {
          this.triggerGameOver(false);
        }
      }, 1000);
    },
    formatTime(seconds) {
      const h = Math.floor(seconds / 3600);
      const m = Math.floor((seconds % 3600) / 60);
      const s = seconds % 60;
      return [
        h.toString().padStart(2, '0'),
        m.toString().padStart(2, '0'),
        s.toString().padStart(2, '0')
      ].join(':');
    },
    selectOption(key) {
      this.selectedOptionKey = key;
    },
    getOptionClass(key) {
      if (this.feedbackActive) {
        if (key === this.selectedOptionKey) {
          return this.feedbackIsCorrect ? 'option-correct' : 'option-incorrect';
        }
        if (key === this.correctAnswerToShow) {
          return 'option-correct-hint';
        }
      } else {
        if (key === this.selectedOptionKey) {
          return 'option-selected';
        }
      }
      return '';
    },
    async submitAnswer() {
      if (!this.selectedOptionKey || this.feedbackActive) return;

      const timeSpent = Math.round((Date.now() - this.questionTimeStarted) / 1000);
      
      try {
        const response = await fetch('/api/game/answer', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: this.userId,
            question_id: this.currentQuestion.id,
            answer: this.selectedOptionKey,
            time_spent: timeSpent
          })
        });

        const data = await response.json();

        if (response.ok) {
          this.feedbackActive = true;
          this.feedbackIsCorrect = data.correct;
          this.correctAnswerToShow = data.correct_answer || this.selectedOptionKey;
          this.score = data.current_score;
          this.scoreUpdated = true;
          setTimeout(() => { this.scoreUpdated = false; }, 1000);
        }
      } catch (error) {
        console.error(error);
      }
    },
    nextQuestion() {
      if (this.isLastQuestionOfPhase) {
        this.advancePhase();
      } else {
        this.activeQuestionIndex++;
        this.resetFeedback();
        this.questionTimeStarted = Date.now();
      }
    },
    async advancePhase() {
      this.loading = true;
      cancelAnimationFrame(this.arcadeLoop);
      try {
        const response = await fetch('/api/game/complete-phase', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            user_id: this.userId,
            phase_id: this.currentPhase.id
          })
        });

        const data = await response.json();

        if (response.ok) {
          if (data.game_over) {
            this.triggerGameOver(true);
          } else {
            this.currentPhase = data.phase;
            this.score = data.score;
            this.activeQuestionIndex = 0;
            this.resetFeedback();
            this.questionTimeStarted = Date.now();
          }
        }
      } catch (error) {
        console.error(error);
      } finally {
        this.loading = false;
      }
    },
    resetFeedback() {
      this.selectedOptionKey = null;
      this.feedbackActive = false;
      this.feedbackIsCorrect = false;
      this.correctAnswerToShow = '';
    },
    triggerGameOver(success) {
      clearInterval(this.timerInterval);
      cancelAnimationFrame(this.arcadeLoop);
      this.gameOver = true;
      this.isSuccess = success;
    },
    restartGame() {
      this.timerSeconds = 18000;
      this.gameOver = false;
      this.isSuccess = false;
      this.score = 0;
      this.startGlobalTimer();
      this.fetchGameState();
    },

    // Handle Keyboard inputs for both Pacman and Snake games
    handleKeyDown(e) {
      if (!this.currentPhase) return;
      
      if (this.currentPhase.order === 2) {
        // Snake Controls
        if (e.key === 'ArrowLeft' && this.snakeDir.x === 0) {
          this.snakeDir = { x: -20, y: 0 };
        } else if (e.key === 'ArrowRight' && this.snakeDir.x === 0) {
          this.snakeDir = { x: 20, y: 0 };
        } else if (e.key === 'ArrowUp' && this.snakeDir.y === 0) {
          this.snakeDir = { x: 0, y: -20 };
        } else if (e.key === 'ArrowDown' && this.snakeDir.y === 0) {
          this.snakeDir = { x: 0, y: 20 };
        }
      } else if (this.currentPhase.order === 3) {
        // Pacman Controls
        if (e.key === 'ArrowLeft') {
          this.pacman.dx = -4; this.pacman.dy = 0;
        } else if (e.key === 'ArrowRight') {
          this.pacman.dx = 4; this.pacman.dy = 0;
        } else if (e.key === 'ArrowUp') {
          this.pacman.dx = 0; this.pacman.dy = -4;
        } else if (e.key === 'ArrowDown') {
          this.pacman.dx = 0; this.pacman.dy = 4;
        }
      }
    },

    // ----------------------------------------------------
    // Arcade: Snake Game (Phase 2 - Cabeamento)
    // ----------------------------------------------------
    initSnakeGame() {
      this.arcadeGameOver = false;
      this.snakeTargetIndex = 0;
      this.snake = [
        { x: 100, y: 100 },
        { x: 80, y: 100 },
        { x: 60, y: 100 }
      ];
      this.snakeDir = { x: 20, y: 0 };
      this.spawnSnakeFood();
      
      cancelAnimationFrame(this.arcadeLoop);
      let lastTime = 0;
      const loop = (time) => {
        if (this.currentPhase.order !== 2 || this.arcadeGameOver) return;
        
        if (!lastTime) lastTime = time;
        const diff = time - lastTime;
        
        if (diff > 120) { // Speed regulator
          this.updateSnake();
          this.drawSnake();
          lastTime = time;
        }
        this.arcadeLoop = requestAnimationFrame(loop);
      };
      this.arcadeLoop = requestAnimationFrame(loop);
    },
    spawnSnakeFood() {
      // Spawn one correct target and one incorrect distractor
      const canvas = this.$refs.snakeCanvas;
      if (!canvas) return;
      
      const rx = Math.floor(Math.random() * (canvas.width / 20)) * 20;
      const ry = Math.floor(Math.random() * (canvas.height / 20)) * 20;
      
      this.snakeFood = [
        { x: rx, y: ry, color: this.t568bOrder[this.snakeTargetIndex], correct: true }
      ];

      // Spawn distractor
      let dx = Math.floor(Math.random() * (canvas.width / 20)) * 20;
      let dy = Math.floor(Math.random() * (canvas.height / 20)) * 20;
      const wrongColor = this.t568bOrder[(this.snakeTargetIndex + 1) % 8];
      this.snakeFood.push({ x: dx, y: dy, color: wrongColor, correct: false });
    },
    updateSnake() {
      const head = { x: this.snake[0].x + this.snakeDir.x, y: this.snake[0].y + this.snakeDir.y };
      
      // Wall collisions
      const canvas = this.$refs.snakeCanvas;
      if (head.x < 0 || head.x >= canvas.width || head.y < 0 || head.y >= canvas.height) {
        this.arcadeGameOver = true;
        return;
      }
      
      // Self collision
      for (let segment of this.snake) {
        if (head.x === segment.x && head.y === segment.y) {
          this.arcadeGameOver = true;
          return;
        }
      }

      this.snake.unshift(head);

      // Check food collision
      let ate = false;
      for (let i = 0; i < this.snakeFood.length; i++) {
        const food = this.snakeFood[i];
        if (head.x === food.x && head.y === food.y) {
          if (food.correct) {
            this.snakeTargetIndex++;
            this.score += 50;
            this.scoreUpdated = true;
            setTimeout(() => { this.scoreUpdated = false; }, 1000);
            ate = true;
            if (this.snakeTargetIndex >= 8) {
              // Finish Snake Level
              this.advancePhase();
              return;
            }
            this.spawnSnakeFood();
          } else {
            // Penalty for incorrect wire
            this.score = Math.max(0, this.score - 20);
            this.spawnSnakeFood();
          }
          break;
        }
      }

      if (!ate) {
        this.snake.pop();
      }
    },
    drawSnake() {
      const canvas = this.$refs.snakeCanvas;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw Grid Lines (cyber style)
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      for (let x = 0; x < canvas.width; x += 20) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += 20) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
      }

      // Draw food
      for (let food of this.snakeFood) {
        ctx.fillStyle = food.correct ? '#10b981' : '#ef4444';
        ctx.fillRect(food.x + 2, food.y + 2, 16, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px monospace';
        ctx.fillText(food.color.substring(0, 5), food.x + 2, food.y + 12);
      }

      // Draw snake (cabo de rede)
      this.snake.forEach((segment, index) => {
        ctx.fillStyle = index === 0 ? '#60a5fa' : '#3b82f6';
        ctx.fillRect(segment.x + 1, segment.y + 1, 18, 18);
      });
    },

    // ----------------------------------------------------
    // Arcade: Pac-man Game (Phase 3 - Lógica/IPs)
    // ----------------------------------------------------
    initPacmanGame() {
      this.arcadeGameOver = false;
      this.pacmanCollectedCount = 0;
      this.pacmanLives = 3;
      this.pacman = { x: 30, y: 30, dx: 0, dy: 0 };
      
      this.spawnPacmanItems();
      this.spawnPacmanGhosts();

      cancelAnimationFrame(this.arcadeLoop);
      const loop = () => {
        if (this.currentPhase.order !== 3 || this.arcadeGameOver) return;
        
        this.updatePacman();
        this.drawPacman();
        
        this.arcadeLoop = requestAnimationFrame(loop);
      };
      this.arcadeLoop = requestAnimationFrame(loop);
    },
    spawnPacmanItems() {
      this.pacmanItems = [
        { x: 100, y: 50, ip: '192.168.10.15', valid: true },
        { x: 220, y: 90, ip: '192.168.10.200', valid: true },
        { x: 50, y: 210, ip: '192.168.11.1', valid: false }, // distractor subnet
        { x: 320, y: 220, ip: '192.168.10.255', valid: false }, // broadcast
        { x: 180, y: 250, ip: '192.168.10.5', valid: true },
        { x: 280, y: 150, ip: '192.168.10.0', valid: false } // network address
      ];
    },
    spawnPacmanGhosts() {
      this.pacmanGhosts = [
        { x: 150, y: 150, dx: 1.5, dy: 0, color: '#f87171' },
        { x: 250, y: 110, dx: 0, dy: 1.5, color: '#f472b6' }
      ];
    },
    updatePacman() {
      const canvas = this.$refs.pacmanCanvas;
      if (!canvas) return;

      // Update pacman position
      this.pacman.x += this.pacman.dx;
      this.pacman.y += this.pacman.dy;

      // Bound constraints
      if (this.pacman.x < 15) this.pacman.x = 15;
      if (this.pacman.x > canvas.width - 15) this.pacman.x = canvas.width - 15;
      if (this.pacman.y < 15) this.pacman.y = 15;
      if (this.pacman.y > canvas.height - 15) this.pacman.y = canvas.height - 15;

      // Update ghosts
      for (let ghost of this.pacmanGhosts) {
        ghost.x += ghost.dx;
        ghost.y += ghost.dy;

        // Bounce ghosts off bounds
        if (ghost.x < 15 || ghost.x > canvas.width - 15) ghost.dx *= -1;
        if (ghost.y < 15 || ghost.y > canvas.height - 15) ghost.dy *= -1;

        // Collision with Pacman
        const dist = Math.hypot(this.pacman.x - ghost.x, this.pacman.y - ghost.y);
        if (dist < 20) {
          this.pacmanLives--;
          this.pacman.x = 30;
          this.pacman.y = 30;
          this.pacman.dx = 0;
          this.pacman.dy = 0;
          
          if (this.pacmanLives <= 0) {
            this.arcadeGameOver = true;
          }
        }
      }

      // Check item collisions
      for (let i = 0; i < this.pacmanItems.length; i++) {
        const item = this.pacmanItems[i];
        const dist = Math.hypot(this.pacman.x - item.x, this.pacman.y - item.y);
        if (dist < 18) {
          if (item.valid) {
            this.pacmanCollectedCount++;
            this.score += 50;
            this.scoreUpdated = true;
            setTimeout(() => { this.scoreUpdated = false; }, 1000);
            
            if (this.pacmanCollectedCount >= 5) {
              // Finish level
              this.advancePhase();
              return;
            }
          } else {
            // Penalty
            this.score = Math.max(0, this.score - 20);
          }
          this.pacmanItems.splice(i, 1);
          // Spawn replacement target
          const rx = Math.max(20, Math.min(canvas.width - 40, Math.random() * canvas.width));
          const ry = Math.max(20, Math.min(canvas.height - 40, Math.random() * canvas.height));
          const ipVal = Math.random() > 0.4;
          this.pacmanItems.push({
            x: rx,
            y: ry,
            ip: ipVal ? `192.168.10.${Math.floor(Math.random() * 253) + 1}` : `192.168.12.${Math.floor(Math.random() * 254)}`,
            valid: ipVal
          });
          break;
        }
      }
    },
    drawPacman() {
      const canvas = this.$refs.pacmanCanvas;
      if (!canvas) return;
      const ctx = canvas.getContext('2d');
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw items (IP packets)
      for (let item of this.pacmanItems) {
        ctx.fillStyle = item.valid ? 'rgba(52, 211, 153, 0.2)' : 'rgba(239, 68, 68, 0.2)';
        ctx.beginPath();
        ctx.arc(item.x, item.y, 14, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffffff';
        ctx.font = '8px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(item.ip.split('.').slice(2).join('.'), item.x, item.y + 3);
      }

      // Draw Pac-man
      ctx.fillStyle = '#fbbf24';
      ctx.beginPath();
      ctx.arc(this.pacman.x, this.pacman.y, 12, 0.2 * Math.PI, 1.8 * Math.PI);
      ctx.lineTo(this.pacman.x, this.pacman.y);
      ctx.fill();

      // Draw Ghosts
      for (let ghost of this.pacmanGhosts) {
        ctx.fillStyle = ghost.color;
        ctx.beginPath();
        ctx.arc(ghost.x, ghost.y, 12, Math.PI, 0, false);
        ctx.lineTo(ghost.x + 12, ghost.y + 12);
        ctx.lineTo(ghost.x - 12, ghost.y + 12);
        ctx.fill();
      }
    }
  }
};
</script>

<style scoped>
.netquest-container {
  min-height: 100vh;
  background: radial-gradient(circle at top, #0f172a 0%, #020617 100%);
  color: #f8fafc;
  font-family: 'Inter', system-ui, -apple-system, sans-serif;
  padding: 1.5rem;
  box-sizing: border-box;
}

.game-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 1.5rem;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.brand {
  font-size: 1.8rem;
  font-weight: 900;
  letter-spacing: -0.05em;
}

.brand-glow {
  background: linear-gradient(135deg, #38bdf8 0%, #0284c7 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 0 15px rgba(56, 189, 248, 0.4));
}

.sub-brand {
  color: #34d399;
  font-size: 0.85rem;
  margin-left: 0.5rem;
  padding: 0.2rem 0.5rem;
  background: rgba(52, 211, 153, 0.1);
  border-radius: 4px;
  border: 1px solid rgba(52, 211, 153, 0.2);
}

.stats-panel {
  display: flex;
  gap: 1rem;
}

.stat-card {
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 8px;
  padding: 0.5rem 1.2rem;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  min-width: 120px;
  position: relative;
  overflow: hidden;
}

.timer-card {
  min-width: 180px;
}

.timer-progress-bar {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 3px;
  background: #38bdf8;
  transition: width 1s linear;
}

.timer-warning .timer-progress-bar {
  background: #ef4444;
}

.stat-label {
  font-size: 0.65rem;
  color: #94a3b8;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.stat-value {
  font-size: 1.25rem;
  font-weight: 700;
}

.text-glowing {
  color: #38bdf8;
  text-shadow: 0 0 8px rgba(56, 189, 248, 0.5);
}

.pulse-green {
  color: #34d399 !important;
  text-shadow: 0 0 12px rgba(52, 211, 153, 0.8) !important;
}

.phase-navigation {
  display: flex;
  justify-content: space-between;
  margin: 1.5rem 0;
  gap: 0.75rem;
}

.phase-tab {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  background: rgba(255, 255, 255, 0.01);
  border: 1px solid rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  padding: 0.75rem 1rem;
}

.phase-tab.active {
  background: rgba(56, 189, 248, 0.08);
  border-color: rgba(56, 189, 248, 0.3);
}

.phase-tab.completed {
  border-color: rgba(52, 211, 153, 0.3);
  background: rgba(52, 211, 153, 0.04);
}

.phase-number {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.75rem;
  font-weight: 700;
}

.phase-tab.active .phase-number {
  background: #38bdf8;
  color: white;
}

.phase-tab.completed .phase-number {
  background: #10b981;
  color: white;
}

.phase-name {
  font-size: 0.85rem;
  font-weight: 600;
}

.phase-mode-badge {
  font-size: 0.65rem;
  color: #64748b;
  text-transform: uppercase;
}

.card-glass {
  background: rgba(15, 23, 42, 0.6);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid rgba(255, 255, 255, 0.05);
  border-radius: 12px;
  padding: 1.5rem;
}

.play-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 1.5rem;
}

.instructions-sidebar {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.arcade-instructions {
  background: rgba(0, 0, 0, 0.25);
  padding: 1rem;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.05);
}

.arcade-title {
  display: block;
  font-size: 0.9rem;
  font-weight: 700;
  color: #fbbf24;
  margin-bottom: 0.5rem;
}

.wiring-order {
  padding-left: 1.25rem;
  font-size: 0.8rem;
  color: #94a3b8;
}

.wiring-order li {
  margin-bottom: 0.25rem;
}

.current-wiring-target {
  color: #38bdf8 !important;
  font-weight: 700;
  text-shadow: 0 0 5px rgba(56, 189, 248, 0.3);
}

.wiring-done {
  text-decoration: line-through;
  color: #64748b !important;
}

.controls-hint {
  font-size: 0.7rem;
  color: #64748b;
  margin-top: 1rem;
  font-style: italic;
}

.subnet-targets {
  font-size: 0.8rem;
  margin-top: 0.5rem;
}

.target-ip {
  padding: 0.25rem;
  border-radius: 4px;
  margin-bottom: 0.25rem;
}

.target-ip.valid {
  background: rgba(52, 211, 153, 0.1);
  color: #34d399;
}

.target-ip.invalid {
  background: rgba(239, 68, 68, 0.1);
  color: #f87171;
}

.arcade-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.arcade-stage-title {
  font-size: 1.2rem;
  font-weight: 700;
}

.canvas-container {
  position: relative;
  border: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 8px;
  background: #020617;
  overflow: hidden;
}

.arcade-canvas {
  display: block;
}

.arcade-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(15, 23, 42, 0.9);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
}

.overlay-msg {
  color: #f87171;
  font-weight: 700;
  font-size: 1.25rem;
}

.arcade-status {
  display: flex;
  justify-content: space-between;
  width: 100%;
  max-width: 400px;
  font-size: 0.9rem;
}

.target-highlight {
  color: #fbbf24;
}

.text-green { color: #34d399; }
.text-red { color: #ef4444; }

.question-container {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  min-height: 400px;
}

.options-grid {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.option-btn {
  display: flex;
  align-items: center;
  gap: 1rem;
  background: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 1rem;
  text-align: left;
  cursor: pointer;
  color: #d1d5db;
  transition: all 0.2s ease;
  width: 100%;
}

.option-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.05);
  border-color: rgba(255, 255, 255, 0.2);
}

.option-letter {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.06);
  font-weight: 700;
}

.option-selected {
  border-color: #38bdf8;
  background: rgba(56, 189, 248, 0.08);
}

.option-correct {
  border-color: #10b981;
  background: rgba(16, 185, 129, 0.1);
}

.option-incorrect {
  border-color: #ef4444;
  background: rgba(239, 68, 68, 0.1);
}

.feedback-banner {
  padding: 1rem;
  border-radius: 8px;
  margin-bottom: 1.5rem;
}

.success-banner {
  background: rgba(16, 185, 129, 0.15);
  border: 1px solid rgba(16, 185, 129, 0.3);
}

.error-banner {
  background: rgba(239, 68, 68, 0.15);
  border: 1px solid rgba(239, 68, 68, 0.3);
}

.btn-primary {
  background: linear-gradient(135deg, #0284c7 0%, #0369a1 100%);
  color: white;
  border: none;
  padding: 0.75rem 1.5rem;
  border-radius: 6px;
  font-weight: 600;
  cursor: pointer;
}

.btn-next {
  background: linear-gradient(135deg, #10b981 0%, #059669 100%);
}

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 4rem;
}

.spinner {
  border: 4px solid rgba(255, 255, 255, 0.1);
  width: 40px;
  height: 40px;
  border-radius: 50%;
  border-left-color: #38bdf8;
  animation: spin 1s linear infinite;
  margin-bottom: 1rem;
}

@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
</style>
