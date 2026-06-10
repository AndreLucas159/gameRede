import {
  AngularNodeAppEngine,
  createNodeRequestHandler,
  isMainModule,
  writeResponseToNodeResponse,
} from '@angular/ssr/node';
import express from 'express';
import {join} from 'node:path';

const browserDistFolder = join(import.meta.dirname, '../browser');

const app = express();
const angularApp = new AngularNodeAppEngine({
  allowedHosts: ['localhost', 'localhost:3000', '127.0.0.1', '127.0.0.1:3000']
});

import { createServer } from 'node:http';
import { WebSocketServer } from 'ws';

const server = createServer(app);
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      wss.clients.forEach((client) => {
        if (client.readyState === 1) {
          client.send(JSON.stringify(data));
        }
      });
    } catch (e) {
      console.error('WebSocket Error:', e);
    }
  });
});
server.on('upgrade', (request, socket, head) => {
  const url = request.url || '';
  if (url === '/api/chat' || url.startsWith('/api/chat?')) {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit('connection', ws, request);
    });
  }
});

app.use(express.json());

const phases: Record<number, any> = {
  1: {
    id: 1,
    name: 'Topologias',
    description: 'Aprenda sobre layouts físicos de rede e jogue o Tiro ao Alvo para identificar as topologias corretas.',
    order: 1,
    theory: 'As topologias de rede definem o layout físico e lógico de interconexão dos hosts. A topologia em Estrela (Star) conecta todos os nós a um concentrador central (como um Switch), oferecendo excelente tolerância a falhas (se um cabo falha, os outros continuam ativos). Na topologia em Barramento (Bus), todos os nós compartilham um único cabo principal (barramento) com terminadores, e um rompimento no cabo principal derruba toda a rede. Na topologia em Anel (Ring), os dispositivos são conectados em círculo e os dados circulam em uma única direção através de um token.',
    question: {
      id: 1,
      title: 'Tolerância a Falhas',
      content: 'Qual topologia física oferece maior tolerância a falhas individuais, garantindo que o rompimento de um cabo de host não derrube o restante da rede local?',
      options: {
        'A': 'Topologia em Estrela (Star)',
        'B': 'Topologia em Barramento (Bus)',
        'C': 'Topologia em Anel (Ring)',
        'D': 'Topologia em Malha Completa (Mesh)'
      },
      correctAnswer: 'A',
      points: 100,
      penalty: 20
    }
  },
  2: {
    id: 2,
    name: 'Modelo OSI / Cabo',
    description: 'Entenda as camadas OSI e crimpe o cabo RJ-45 no padrão T568B controlando o Aladdin Flying Carpet.',
    order: 2,
    theory: 'O Modelo OSI (Open Systems Interconnection) organiza a pilha de rede em 7 camadas funcionais: Física (bits), Link de Dados (quadros), Rede (pacotes), Transporte (segmentos), Sessão, Apresentação e Aplicação. Na camada Física, os cabos de par trançado UTP são crimpados no padrão T568B para conexões RJ-45. A ordem de crimpagem padrão T568B é: 1. Branco-Laranja, 2. Laranja, 3. Branco-Verde, 4. Azul, 5. Branco-Azul, 6. Verde, 7. Branco-Marrom, 8. Marrom. A crimpagem incorreta causa perda de sinal ou atenuação extrema.'
  },
  3: {
    id: 3,
    name: 'Sub-redes IPv4',
    description: 'Estude o endereçamento lógico e escape dos vírus no Donkey Kong coletando apenas IPs válidos.',
    order: 3,
    theory: 'O endereçamento IPv4 identifica logicamente dispositivos na rede. Uma máscara de sub-rede define a divisão entre a parte de Rede e a parte de Host. No segmento 192.168.10.0/24 (máscara 255.255.255.0), o primeiro endereço (192.168.10.0) representa o endereço de rede e o último endereço (192.168.10.255) representa o endereço de broadcast. Ambos não podem ser atribuídos a hosts individuais. Os IPs válidos e utilizáveis para placas de rede de computadores e switches vão de 192.168.10.1 a 192.168.10.254.'
  },
  4: {
    id: 4,
    name: 'Roteamento',
    description: 'Aprenda rotas estáticas e protocolos de teste, disparando pacotes no roteador correto.',
    order: 4,
    theory: 'O Roteamento é o processo de encaminhar pacotes entre redes de sub-redes diferentes. Roteadores leem os cabeçalhos IP de camada 3 e consultam sua tabela de rotas para determinar o próximo salto (next hop / gateway). Para testar a conectividade fim-a-fim da camada de Rede, o comando ping envia pacotes de eco utilizando o protocolo ICMP (Internet Control Message Protocol), que é encapsulado diretamente em pacotes IP sem utilizar conexões TCP ou UDP.',
    question: {
      id: 4,
      title: 'Protocolo de Teste de Rede',
      content: 'Ao executar o comando de diagnóstico "ping" no terminal para verificar a conectividade local, qual protocolo da camada de Rede é utilizado?',
      options: {
        'A': 'TCP (Transmission Control Protocol)',
        'B': 'ICMP (Internet Control Message Protocol)',
        'C': 'UDP (User Datagram Protocol)',
        'D': 'ARP (Address Resolution Protocol)'
      },
      correctAnswer: 'B',
      points: 100,
      penalty: 25
    }
  },
  5: {
    id: 5,
    name: 'Segurança',
    description: 'Estude regras de firewall e proteja o perímetro da rede no Space Invaders contra os malwares.',
    order: 5,
    theory: 'A segurança de perímetro protege a rede local contra ataques externos. O Firewall inspeciona o tráfego filtrando pacotes por portas (ex: porta 80 para HTTP, porta 443 para HTTPS). A regra de ouro da segurança perimetral é a política de Bloqueio Padrão (Default Deny ou Restritiva), na qual todo o tráfego é bloqueado de início e apenas serviços explicitamente confiáveis e necessários são abertos. Isso previne vulnerabilidades em portas não monitoradas.',
    question: {
      id: 5,
      title: 'Políticas de Firewall',
      content: 'Qual política padrão de firewall é considerada a melhor prática de segurança para impedir conexões externas não autorizadas em servidores locais?',
      options: {
        'A': 'Permitir todo tráfego por padrão e criar regras específicas de bloqueio (Permissive)',
        'B': 'Bloquear todo tráfego por padrão e liberar apenas portas e IPs autorizados (Restrictive / Default Deny)',
        'C': 'Bloquear apenas pacotes de broadcast locais',
        'D': 'Desativar filtros de portas efêmeras'
      },
      correctAnswer: 'B',
      points: 100,
      penalty: 20
    }
  }
};

const playerState = {
  score: 0,
  currentStage: 1,
  unlockedStages: [1],
  completedStages: [] as number[],
  theoryRead: false,
  retryCount: 0
};

function broadcastToAll(data: any) {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify(data));
    }
  });
}

// Get State
app.get('/api/game/state', (req, res) => {
  const currentPhase = phases[playerState.currentStage];
  return res.json({
    phase: currentPhase,
    score: playerState.score,
    unlockedStages: playerState.unlockedStages,
    completedStages: playerState.completedStages,
    currentStage: playerState.currentStage,
    theoryRead: playerState.theoryRead,
    retryCount: playerState.retryCount
  });
});

// Select Stage
app.post('/api/game/select-stage', (req, res) => {
  const { stage } = req.body;
  const stageNum = parseInt(stage, 10);
  if (playerState.unlockedStages.includes(stageNum) && phases[stageNum]) {
    playerState.currentStage = stageNum;
    playerState.retryCount = 0;
    playerState.theoryRead = playerState.completedStages.includes(stageNum);
  }
  const currentPhase = phases[playerState.currentStage];
  return res.json({
    phase: currentPhase,
    score: playerState.score,
    unlockedStages: playerState.unlockedStages,
    completedStages: playerState.completedStages,
    currentStage: playerState.currentStage,
    theoryRead: playerState.theoryRead,
    retryCount: playerState.retryCount
  });
});

// Read Theory Slide
app.post('/api/game/read-theory', (req, res) => {
  playerState.theoryRead = true;
  return res.json({
    success: true,
    theoryRead: playerState.theoryRead
  });
});

// Reset Game
app.post('/api/game/reset', (req, res) => {
  playerState.score = 0;
  playerState.currentStage = 1;
  playerState.unlockedStages = [1];
  playerState.completedStages = [];
  playerState.theoryRead = false;
  playerState.retryCount = 0;
  broadcastToAll({
    type: 'achievement',
    user: 'LUCAS',
    text: 'LUCAS reiniciou a simulação NetQuest!'
  });
  broadcastToAll({
    type: 'score_update',
    user: 'Lucas Santos',
    score: 0
  });
  return res.json({ success: true });
});

// Submit Answer
app.post('/api/game/answer', (req, res) => {
  const { answer } = req.body;
  const currentPhase = phases[playerState.currentStage];
  if (!currentPhase || !currentPhase.question) {
    return res.status(400).json({ error: 'Nenhuma questão ativa' });
  }

  const isCorrect = answer === currentPhase.question.correctAnswer;
  
  if (isCorrect) {
    // Second chance scoring: deduct 25% reward for each retry, min reward of 25%
    const multiplier = Math.max(0.25, 1 - (playerState.retryCount * 0.25));
    const pointsChange = Math.round(currentPhase.question.points * multiplier);
    playerState.score = Math.max(0, playerState.score + pointsChange);
    
    broadcastToAll({
      type: 'achievement',
      user: 'LUCAS',
      text: `LUCAS acertou a questão no módulo "${currentPhase.name}"! (+${pointsChange} pts)`
    });
    broadcastToAll({
      type: 'score_update',
      user: 'Lucas Santos',
      score: playerState.score
    });

    return res.json({
      correct: true,
      points_change: pointsChange,
      current_score: playerState.score,
      correct_answer: null
    });
  } else {
    // Incorrect answer penalty, increments retry count, allow retry
    playerState.retryCount += 1;
    const penalty = currentPhase.question.penalty;
    playerState.score = Math.max(0, playerState.score - penalty);
    
    broadcastToAll({
      type: 'achievement',
      user: 'LUCAS',
      text: `LUCAS respondeu incorreto no módulo "${currentPhase.name}"! (-${penalty} pts, Tentativa: ${playerState.retryCount})`
    });
    broadcastToAll({
      type: 'score_update',
      user: 'Lucas Santos',
      score: playerState.score
    });

    return res.json({
      correct: false,
      points_change: -penalty,
      current_score: playerState.score,
      correct_answer: null // do not reveal yet, allow retry!
    });
  }
});

// Complete Phase
app.post('/api/game/complete-phase', (req, res) => {
  const currentPhase = phases[playerState.currentStage];
  if (!currentPhase) {
    return res.status(400).json({ error: 'Fase inválida' });
  }

  if (!playerState.completedStages.includes(playerState.currentStage)) {
    playerState.completedStages.push(playerState.currentStage);
  }

  const nextStage = playerState.currentStage + 1;
  let gameOver = false;

  playerState.retryCount = 0;

  if (phases[nextStage]) {
    playerState.currentStage = nextStage;
    playerState.theoryRead = playerState.completedStages.includes(nextStage);
    if (!playerState.unlockedStages.includes(nextStage)) {
      playerState.unlockedStages.push(nextStage);
    }
    broadcastToAll({
      type: 'achievement',
      user: 'LUCAS',
      text: `LUCAS concluiu o módulo "${currentPhase.name}" e liberou o módulo "${phases[nextStage].name}"!`
    });
  } else {
    gameOver = true;
    broadcastToAll({
      type: 'achievement',
      user: 'LUCAS',
      text: '🏆 LUCAS CONCLUIU TODOS OS MÓDULOS DO NETQUEST E ADQUIRIU A CERTIFICAÇÃO!'
    });
  }

  return res.json({
    game_over: gameOver,
    phase: phases[playerState.currentStage],
    score: playerState.score,
    unlockedStages: playerState.unlockedStages,
    completedStages: playerState.completedStages,
    currentStage: playerState.currentStage
  });
});

// Add Score Directly (For arcade games)
app.post('/api/game/score', (req, res) => {
  const { amount, eventName } = req.body;
  playerState.score = Math.max(0, playerState.score + (amount || 0));

  if (eventName) {
    broadcastToAll({
      type: 'achievement',
      user: 'LUCAS',
      text: `LUCAS ${eventName}! (${amount >= 0 ? '+' : ''}${amount} pts)`
    });
  }
  broadcastToAll({
    type: 'score_update',
    user: 'Lucas Santos',
    score: playerState.score
  });

  return res.json({
    score: playerState.score
  });
});


/**
 * Serve static files from /browser
 */
app.use(
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: false,
    redirect: false,
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.use((req, res, next) => {
  angularApp
    .handle(req)
    .then((response) =>
      response ? writeResponseToNodeResponse(response, res) : next(),
    )
    .catch(next);
});

/**
 * Start the server if this module is the main entry point, or it is ran via PM2.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url) || process.env['pm_id']) {
  const port = process.env['PORT'] || 3000; // Force 3000
  server.listen(port, () => {
    // Note: server.listen instead of app.listen
    console.log(`Node Express server listening on http://localhost:${port} with WebSockets`);
  });
}

/**
 * Request handler used by the Angular CLI (for dev-server and during build) or Firebase Cloud Functions.
 */
export const reqHandler = createNodeRequestHandler(app);

