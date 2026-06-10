<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use App\Models\Phase;
use App\Models\Question;

class NetQuestSeeder extends Seeder
{
    public function run(): void
    {
        // Phase 1
        $p1 = Phase::create([
            'name' => 'Planejamento (Topologia/Equipamentos)',
            'description' => 'Defina a topologia da rede local e selecione os equipamentos ativos e passivos corretos com base nas necessidades do cliente.',
            'order' => 1
        ]);

        Question::create([
            'phase_id' => $p1->id,
            'title' => 'Escolha da Topologia',
            'content' => 'Qual topologia física oferece maior tolerância a falhas de conexão individual de hosts sem derrubar a rede inteira?',
            'options' => [
                'A' => 'Topologia em Estrela (Star)',
                'B' => 'Topologia em Barramento (Bus)',
                'C' => 'Topologia em Anel (Ring)',
                'D' => 'Topologia Ponto-a-Ponto (Mesh)'
            ],
            'correct_answer' => 'A',
            'points' => 100,
            'penalty' => 20
        ]);

        // Phase 2 (Arcade Snake inside UI)
        $p2 = Phase::create([
            'name' => 'Infraestrutura (Cabeamento)',
            'description' => 'Crimpagem de cabos de par trançado UTP. Controle o Cabling Snake para coletar as cores na sequência exata do padrão T568B.',
            'order' => 2
        ]);

        // Phase 3 (Arcade Pacman inside UI)
        $p3 = Phase::create([
            'name' => 'Lógica (Endereçamento)',
            'description' => 'Configuração lógica e sub-redes. Guie o pacote de dados no Subnet Pac-man e colete apenas os IPs válidos para o segmento 192.168.10.0/24.',
            'order' => 3
        ]);

        // Phase 4
        $p4 = Phase::create([
            'name' => 'Validação (Troubleshooting)',
            'description' => 'Realize testes de conectividade e resolva problemas comuns na implantação da rede local.',
            'order' => 4
        ]);

        Question::create([
            'phase_id' => $p4->id,
            'title' => 'Comando de Diagnóstico',
            'content' => 'Ao testar a conectividade de camada lógica de rede entre dois hosts, qual protocolo é encapsulado pelo comando "ping"?',
            'options' => [
                'A' => 'TCP (Transmission Control Protocol)',
                'B' => 'ICMP (Internet Control Message Protocol)',
                'C' => 'UDP (User Datagram Protocol)',
                'D' => 'ARP (Address Resolution Protocol)'
            ],
            'correct_answer' => 'B',
            'points' => 100,
            'penalty' => 25
        ]);
    }
}
