<?php

namespace App\Http\Controllers;

use App\Models\Phase;
use App\Models\Question;
use App\Models\UserProgress;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Carbon\Carbon;

class GameController extends Controller
{
    public function getCurrentState(Request $request): JsonResponse
    {
        $userId = auth()->id() ?? $request->input('user_id', 1);

        $currentProgress = UserProgress::where('user_id', $userId)
            ->whereNull('completed_at')
            ->orderBy('phase_id', 'desc')
            ->first();

        if (!$currentProgress) {
            $firstPhase = Phase::orderBy('order', 'asc')->first();
            if (!$firstPhase) {
                return response()->json(['message' => 'Nenhuma fase configurada.'], 404);
            }
            $currentProgress = UserProgress::create([
                'user_id' => $userId,
                'phase_id' => $firstPhase->id,
                'score' => 0,
                'time_spent' => 0
            ]);
        }

        $phase = Phase::with(['questions' => function ($query) {
            $query->select('id', 'phase_id', 'title', 'content', 'options', 'points', 'penalty');
        }])->find($currentProgress->phase_id);

        return response()->json([
            'phase' => $phase,
            'score' => $currentProgress->score,
            'time_spent' => $currentProgress->time_spent,
            'completed' => false
        ]);
    }

    public function submitAnswer(Request $request): JsonResponse
    {
        $request->validate([
            'question_id' => 'required|exists:questions,id',
            'answer' => 'required|string',
            'time_spent' => 'required|integer'
        ]);

        $userId = auth()->id() ?? $request->input('user_id', 1);
        $question = Question::findOrFail($request->question_id);

        $progress = UserProgress::where('user_id', $userId)
            ->where('phase_id', $question->phase_id)
            ->whereNull('completed_at')
            ->first();

        if (!$progress) {
            return response()->json(['message' => 'Progresso ativo não encontrado para esta fase.'], 404);
        }

        $isCorrect = trim(strtolower($question->correct_answer)) === trim(strtolower($request->answer));
        $pointsChange = $isCorrect ? $question->points : -$question->penalty;

        $newScore = max(0, $progress->score + $pointsChange);
        $progress->update([
            'score' => $newScore,
            'time_spent' => $progress->time_spent + $request->time_spent
        ]);

        return response()->json([
            'correct' => $isCorrect,
            'points_change' => $pointsChange,
            'current_score' => $newScore,
            'correct_answer' => $isCorrect ? null : $question->correct_answer
        ]);
    }

    public function completePhase(Request $request): JsonResponse
    {
        $request->validate([
            'phase_id' => 'required|exists:phases,id'
        ]);

        $userId = auth()->id() ?? $request->input('user_id', 1);

        $progress = UserProgress::where('user_id', $userId)
            ->where('phase_id', $request->phase_id)
            ->whereNull('completed_at')
            ->first();

        if ($progress) {
            $progress->update(['completed_at' => Carbon::now()]);
        }

        $currentPhase = Phase::find($request->phase_id);
        $nextPhase = Phase::where('order', '>', $currentPhase->order)
            ->orderBy('order', 'asc')
            ->first();

        if ($nextPhase) {
            $newProgress = UserProgress::create([
                'user_id' => $userId,
                'phase_id' => $nextPhase->id,
                'score' => $progress ? $progress->score : 0,
                'time_spent' => 0
            ]);

            $phase = Phase::with(['questions' => function ($query) {
                $query->select('id', 'phase_id', 'title', 'content', 'options', 'points', 'penalty');
            }])->find($nextPhase->id);

            return response()->json([
                'game_over' => false,
                'phase' => $phase,
                'score' => $newProgress->score
            ]);
        }

        return response()->json([
            'game_over' => true,
            'message' => 'Parabéns! Você concluiu com sucesso todas as fases do NetQuest UC1!'
        ]);
    }
}
