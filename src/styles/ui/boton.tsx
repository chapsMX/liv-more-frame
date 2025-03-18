interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    children: React.ReactNode;
    isLoading?: boolean;
  }
  
  export function Boton({ children, className = "", isLoading = false, ...props }: ButtonProps) {
    return (
      <button
        className={`flex items-center justify-center gap-2 px-4 py-2 bg-transparent border-2 border-[#ff8800] text-[#ff8800] hover:bg-[#ff8800] hover:text-white rounded-full min-w-[80px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
        {...props}
      >
        {isLoading ? (
          <div className="flex items-center justify-center">
            <div className="animate-spin h-5 w-5 border-2 border-[#ff8800] border-t-transparent rounded-full" />
          </div>
        ) : (
          children
        )}
      </button>
    );
  }