/**
 * UTILS/FORMATTING.JS - Utilidades de formateo
 * Responsabilidad: Formatear números, textos, duraciones
 */

const formatUtils = {
    number(value, compact = false) {
        const num = Math.floor(value);
        if (compact && num >= 1000000) {
            return `${(num / 1000000).toFixed(1)}M`;
        }
        if (compact && num >= 1000) {
            return `${(num / 1000).toFixed(1)}k`;
        }
        return num.toLocaleString();
    },
    
    duration(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return minutes > 0 ? `${minutes}m ${secs}s` : `${secs}s`;
    }
};

console.log('✅ FORMATTING UTILS loaded');
