'use client';

import { useState, useRef } from 'react';
import { ProductService } from '../config/api';
import { CloudArrowUpIcon, PhotoIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface CloudinaryImageUploadProps {
  currentImage?: string;
  onImageChange: (imageUrl: string) => void;
  placeholder?: string;
  accept?: string;
  maxSize?: number;
}

export default function CloudinaryImageUpload({
  currentImage,
  onImageChange,
  placeholder = "Choisir une image pour Cloudinary",
  accept = "image/*",
  maxSize = 5 * 1024 * 1024, // 5MB (limite Cloudinary gratuit)
}: CloudinaryImageUploadProps) {
  const [preview, setPreview] = useState<string>(currentImage || '');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validateFile = (file: File): string | null => {
    // Vérifier le type
    if (!file.type.startsWith('image/')) {
      return 'Le fichier doit être une image (JPG, PNG, GIF, WEBP)';
    }

    // Vérifier la taille
    if (file.size > maxSize) {
      const maxSizeMB = maxSize / (1024 * 1024);
      return `L'image ne doit pas dépasser ${maxSizeMB}MB`;
    }

    return null;
  };

  const handleFileUpload = async (file: File) => {
    setError('');
    
    // Validation
    const validationError = validateFile(file);
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setUploading(true);
      setUploadProgress(0);

      // Créer une prévisualisation locale pendant l'upload
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        setPreview(result);
      };
      reader.readAsDataURL(file);

      // Simuler la progression
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 200);

      // Upload vers Cloudinary via le backend
      const result = await ProductService.uploadImage(file);

      clearInterval(progressInterval);
      setUploadProgress(100);

      // Utiliser l'URL Cloudinary
      setPreview(result.url);
      onImageChange(result.url);

      console.log('✅ Image uploadée avec succès sur Cloudinary:', result.url);

      // Reset après succès
      setTimeout(() => {
        setUploadProgress(0);
        setUploading(false);
      }, 1000);

    } catch (error) {
      console.error('❌ Erreur upload:', error);
      setError(error instanceof Error ? error.message : 'Erreur lors de l\'upload');
      setUploadProgress(0);
      setUploading(false);
      setPreview(currentImage || '');
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFileUpload(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleClick = () => {
    if (!uploading) {
      fileInputRef.current?.click();
    }
  };

  const removeImage = () => {
    setPreview('');
    setError('');
    onImageChange('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-3">
      {/* Zone de prévisualisation */}
      {preview && (
        <div className="relative">
          <div className="w-full h-48 bg-gray-100 rounded-lg overflow-hidden border-2 border-gray-200">
            <img
              src={preview}
              alt="Prévisualisation"
              className="w-full h-full object-contain"
            />
            {uploading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-2"></div>
                  <p className="text-white text-sm">Upload vers Cloudinary... {uploadProgress}%</p>
                </div>
              </div>
            )}
          </div>
          {!uploading && (
            <button
              onClick={removeImage}
              className="absolute top-2 right-2 bg-red-500 text-white w-8 h-8 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors shadow-lg"
              type="button"
              title="Supprimer l'image"
              aria-label="Supprimer l’image"
            >
              <XMarkIcon className="w-5 h-5" />
            </button>
          )}
          {preview.includes('cloudinary.com') && !uploading && (
            <div className="absolute bottom-2 left-2 bg-green-500 text-white px-2 py-1 rounded text-xs flex items-center gap-1">
              <CloudArrowUpIcon className="w-4 h-4" />
              Cloudinary
            </div>
          )}
        </div>
      )}

      {/* Barre de progression */}
      {uploading && uploadProgress > 0 && (
        <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
          <div 
            className="bg-orange-600 h-2 transition-all duration-300 ease-out"
            style={{ width: `${uploadProgress}%` }}
          ></div>
        </div>
      )}

      {/* Message d'erreur */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          <strong>Erreur :</strong> {error}
        </div>
      )}

      {/* Zone d'upload */}
      {!uploading && (
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-all duration-300 ${
            isDragging
              ? 'border-orange-500 bg-orange-50'
              : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50'
          } ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
          onClick={handleClick}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept={accept}
            onChange={handleInputChange}
            className="hidden"
            disabled={uploading}
          />
          
          <div className="flex flex-col items-center gap-2">
            {uploading ? (
              <>
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600"></div>
                <p className="text-sm font-medium text-orange-700">
                  Upload en cours vers Cloudinary...
                </p>
              </>
            ) : (
              <>
                <CloudArrowUpIcon className="w-12 h-12 text-orange-500" />
                <p className="text-sm font-medium text-gray-700">
                  {placeholder}
                </p>
                <p className="text-xs text-gray-500">
                  Glissez-déposez ou cliquez pour choisir
                </p>
                <p className="text-xs text-gray-400">
                  PNG, JPG, GIF, WEBP jusqu'à 5MB
                </p>
                <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                  <CloudArrowUpIcon className="w-4 h-4" />
                  <span>Upload automatique vers Cloudinary CDN</span>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Boutons d'action */}
      {!uploading && (
        <div className="flex gap-2">
          <button
            onClick={handleClick}
            type="button"
            className="flex-1 bg-orange-100 text-orange-700 py-2 px-4 rounded-lg hover:bg-orange-200 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            disabled={uploading}
          >
            <PhotoIcon className="w-4 h-4" />
            Parcourir
          </button>
          {preview && (
            <button
              onClick={removeImage}
              type="button"
              className="bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium flex items-center justify-center gap-2"
            >
              <XMarkIcon className="w-4 h-4" />
              Supprimer
            </button>
          )}
        </div>
      )}

      {/* Info Cloudinary */}
      <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg border border-gray-200">
        <p className="flex items-center gap-1 font-medium text-gray-700 mb-1">
          <CloudArrowUpIcon className="w-4 h-4 text-green-500" />
          Stockage Cloudinary activé
        </p>
        <ul className="space-y-1 ml-5 list-disc">
          <li>Images optimisées automatiquement (WebP, compression)</li>
          <li>CDN mondial pour chargement ultra-rapide</li>
          <li>Backup sécurisé et transformations à la volée</li>
        </ul>
      </div>
    </div>
  );
}
