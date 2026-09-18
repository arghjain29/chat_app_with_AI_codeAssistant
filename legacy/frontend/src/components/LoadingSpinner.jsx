const LoadingSpinner = ({ size = "md", className = "" }) => {
    const sizeClasses = {
        sm: "w-4 h-4",
        md: "w-6 h-6",
        lg: "w-10 h-10",
    };

    return (
        <div className={`${sizeClasses[size]} border-2 border-white/20 border-t-white rounded-full animate-spin ${className}`}></div>
    );
};

export default LoadingSpinner;
