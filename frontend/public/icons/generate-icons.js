// Simple icon generator for PWA
// This creates basic blue square icons with a dumbbell symbol

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

// Create a simple canvas-based icon generator
function createIcon(size) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  
  // Background circle
  ctx.fillStyle = '#3b82f6';
  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2 - 4, 0, 2 * Math.PI);
  ctx.fill();
  
  // Dumbbell
  const centerX = size / 2;
  const centerY = size / 2;
  const scale = size / 512;
  
  ctx.fillStyle = '#ffffff';
  
  // Left weight
  ctx.fillRect(centerX - 60 * scale, centerY - 10 * scale, 20 * scale, 20 * scale);
  
  // Bar
  ctx.fillRect(centerX - 40 * scale, centerY - 4 * scale, 80 * scale, 8 * scale);
  
  // Right weight
  ctx.fillRect(centerX + 40 * scale, centerY - 10 * scale, 20 * scale, 20 * scale);
  
  return canvas.toDataURL('image/png');
}

// For now, we'll use placeholder icons
// In production, replace these with proper PNG files generated from the SVG
