<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Question extends Model
{
    protected $fillable = [
        'phase_id',
        'title',
        'content',
        'options',
        'correct_answer',
        'points',
        'penalty'
    ];

    protected $casts = [
        'options' => 'array'
    ];

    public function phase(): BelongsTo
    {
        return $this->belongsTo(Phase::class);
    }
}
