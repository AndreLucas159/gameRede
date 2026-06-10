<?php

use App\Http\Controllers\GameController;
use Illuminate\Support\Facades\Route;

Route::get('/game/state', [GameController::class, 'getCurrentState']);
Route::post('/game/answer', [GameController::class, 'submitAnswer']);
Route::post('/game/complete-phase', [GameController::class, 'completePhase']);
