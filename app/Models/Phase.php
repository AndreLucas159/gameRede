<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Phase extends Model
{
    protected $fillable = ['name', 'description', 'order'];

    public function questions(): HasMany
    {
        return $this->hasMany(Question::class)->orderBy('id');
    }
}
