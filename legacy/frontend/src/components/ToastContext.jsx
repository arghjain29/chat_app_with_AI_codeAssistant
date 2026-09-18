import { createContext, useState, useCallback } from "react";

export const ToastContext = createContext();

let toastId = 0;

export const ToastProvider = ({ children }) => {
    const [toasts, setToasts] = useState([]);

    const addToast = useCallback((message, type = "info", duration = 4000) => {
        const id = ++toastId;
        setToasts((prev) => [...prev, { id, message, type }]);
        if (duration > 0) {
            setTimeout(() => {
                setToasts((prev) => prev.filter((t) => t.id !== id));
            }, duration);
        }
        return id;
    }, []);

    const removeToast = useCallback((id) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    const toast = {
        success: (msg, dur) => addToast(msg, "success", dur),
        error: (msg, dur) => addToast(msg, "error", dur || 6000),
        warning: (msg, dur) => addToast(msg, "warning", dur),
        info: (msg, dur) => addToast(msg, "info", dur),
    };

    const typeStyles = {
        success: "bg-green-500/90 border-green-400",
        error: "bg-red-500/90 border-red-400",
        warning: "bg-yellow-500/90 border-yellow-400",
        info: "bg-blue-500/90 border-blue-400",
    };

    const typeIcons = {
        success: "ri-check-line",
        error: "ri-close-circle-line",
        warning: "ri-alert-line",
        info: "ri-information-line",
    };

    return (
        <ToastContext.Provider value={{ toast, removeToast }}>
            {children}
            <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map((t) => (
                    <div
                        key={t.id}
                        className={`pointer-events-auto flex items-center gap-3 px-4 py-3 rounded-lg border text-white shadow-lg animate-slide-in min-w-72 ${typeStyles[t.type]}`}
                    >
                        <i className={`${typeIcons[t.type]} text-lg`}></i>
                        <span className="flex-1 text-sm">{t.message}</span>
                        <button
                            onClick={() => removeToast(t.id)}
                            className="text-white/70 hover:text-white transition-colors"
                        >
                            <i className="ri-close-line"></i>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
