import { ChangeDetectionStrategy, Component, signal, OnInit, OnDestroy, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
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
  imports: [RouterOutlet, MatIconModule],
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
    { name: 'Lucas Santos', score: 12450 },
    { name: 'Ana Beatriz', score: 11200 },
    { name: 'Marcos Silva', score: 10890 }
  ]);

  newMessage = signal('');
  latency = signal('12ms');

  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.connectWebSocket();
    }
  }

  ngOnDestroy() {
    if (this.ws) {
      this.ws.close();
    }
  }

  private connectWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/chat`;
    
    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.serverStatus.set('Online (WebSocket Connected)');
      // simulate initial achievement or welcome if needed
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'message' || data.type === 'achievement') {
          this.chatMessages.update(msgs => [...msgs, data]);
          this.scrollToBottom();
        } else if (data.type === 'score_update') {
          this.ranking.update(ranks => {
            const newRanks = ranks.map(r => r.name === data.user ? { ...r, score: data.score } : r);
            return newRanks.sort((a, b) => b.score - a.score);
          });
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
    // A simple timeout to let angular render before we scroll
    setTimeout(() => {
      const chatContainer = document.getElementById('chat-container');
      if (chatContainer) {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    }, 50);
  }

  triggerSimulation() {
    this.latency.set('8ms');
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({
         type: 'achievement',
         user: 'LUCAS',
         text: "LUCAS acabou de completar 'Configuração de Roteadores Estáticos'"
      }));
      this.ws.send(JSON.stringify({
         type: 'score_update',
         user: 'Lucas Santos',
         score: this.ranking()[0].score + 500
      }));
    }
  }
}

