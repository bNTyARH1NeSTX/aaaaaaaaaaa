"use client";

import React, { useState } from 'react';
import { ThumbsUp, ThumbsDown, MessageCircle, Check, X } from 'lucide-react';
import { submitChatFeedback, ChatFeedbackRequest } from '../api/apiService';

interface ChatFeedbackProps {
  conversationId: string;
  responseId: string;
  query: string;
  response: string;
  modelUsed?: string;
  relevantImages?: number;
  onFeedbackSubmitted?: (rating: 'up' | 'down') => void;
}

export default function ChatFeedback({
  conversationId,
  responseId,
  query,
  response,
  modelUsed,
  relevantImages,
  onFeedbackSubmitted
}: ChatFeedbackProps) {
  const [rating, setRating] = useState<'up' | 'down' | null>(null);
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleThumbsClick = async (selectedRating: 'up' | 'down') => {
    if (isSubmitted) return;
    
    setRating(selectedRating);
    setError(null);
    
    // For thumbs down, show comment box
    if (selectedRating === 'down') {
      setShowCommentBox(true);
    } else {
      // For thumbs up, submit immediately
      await submitFeedback(selectedRating, '');
    }
  };

  const submitFeedback = async (selectedRating: 'up' | 'down', feedbackComment: string) => {
    try {
      setIsSubmitting(true);
      setError(null);

      const feedbackRequest: ChatFeedbackRequest = {
        conversation_id: conversationId,
        response_id: responseId,
        query: query,
        response: response,
        rating: selectedRating,
        comment: feedbackComment || undefined,
        model_used: modelUsed,
        relevant_images: relevantImages,
      };

      const result = await submitChatFeedback(feedbackRequest);
      
      if (result.success) {
        setIsSubmitted(true);
        setShowCommentBox(false);
        onFeedbackSubmitted?.(selectedRating);
      } else {
        setError(result.message || 'Error al enviar feedback');
      }
    } catch (err) {
      setError('Error al enviar feedback. Por favor, inténtalo de nuevo.');
      console.error('Error submitting feedback:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCommentSubmit = async () => {
    if (rating) {
      await submitFeedback(rating, comment);
    }
  };

  const handleCommentCancel = () => {
    setShowCommentBox(false);
    setComment('');
    setRating(null);
  };

  if (isSubmitted) {
    return (
      <div className="flex items-center gap-2 text-green-600 dark:text-green-400 text-sm">
        <Check className="w-4 h-4" />
        <span>¡Gracias por tu feedback!</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Thumbs buttons */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-500 dark:text-gray-400">¿Fue útil esta respuesta?</span>
        <button
          onClick={() => handleThumbsClick('up')}
          disabled={isSubmitting || isSubmitted}
          className={`p-1.5 rounded-full transition-colors ${
            rating === 'up'
              ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-green-600 dark:hover:text-green-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Thumbs up"
        >
          <ThumbsUp className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleThumbsClick('down')}
          disabled={isSubmitting || isSubmitted}
          className={`p-1.5 rounded-full transition-colors ${
            rating === 'down'
              ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          title="Thumbs down"
        >
          <ThumbsDown className="w-4 h-4" />
        </button>
      </div>

      {/* Comment box for negative feedback */}
      {showCommentBox && (
        <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-600">
          <div className="flex items-start gap-2 mb-2">
            <MessageCircle className="w-4 h-4 text-gray-500 dark:text-gray-400 mt-0.5" />
            <span className="text-sm text-gray-700 dark:text-gray-300">
              ¿Qué podríamos mejorar? (Opcional)
            </span>
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Escribe tus comentarios aquí..."
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white resize-none"
            rows={3}
            disabled={isSubmitting}
          />
          <div className="flex justify-end gap-2 mt-2">
            <button
              onClick={handleCommentCancel}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 disabled:opacity-50"
            >
              <X className="w-4 h-4" />
            </button>
            <button
              onClick={handleCommentSubmit}
              disabled={isSubmitting}
              className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1"
            >
              {isSubmitting ? (
                <>
                  <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  Enviar
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Error message */}
      {error && (
        <div className="text-xs text-red-600 dark:text-red-400 flex items-center gap-1">
          <X className="w-3 h-3" />
          {error}
        </div>
      )}
    </div>
  );
}
