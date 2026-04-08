/**
 * UTILS/STORAGE.JS - Persistencia y sincronización de datos
 * Responsabilidad: Manejar localStorage y datos persistentes
 */

const storageUtils = {
    save(key, data) {
        localStorage.setItem(key, JSON.stringify(data));
    },
    
    load(key) {
        const data = localStorage.getItem(key);
        return data ? JSON.parse(data) : null;
    },
    
    clear(key) {
        localStorage.removeItem(key);
    }
};

console.log('✅ STORAGE UTILS loaded');
