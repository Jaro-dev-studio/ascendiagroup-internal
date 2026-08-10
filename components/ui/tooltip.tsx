"use client";

import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "bottom" | "left" | "top" | "right";
  showArrow?: boolean;
  className?: string;
  delayDuration?: number;
}

const Tooltip = ({
  content,
  children,
  side = "top",
  showArrow = true,
  className = "",
  delayDuration = 150,
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  let showTimeout: any;

  const calculatePosition = () => {
    if (!triggerRef.current || !tooltipRef.current) return;

    const triggerRect = triggerRef.current.getBoundingClientRect();
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const spacing = 10;

    let top = 0;
    let left = 0;

    switch (side) {
      case "top":
        top = triggerRect.top - tooltipRect.height - spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case "bottom":
        top = triggerRect.bottom + spacing;
        left = triggerRect.left + (triggerRect.width - tooltipRect.width) / 2;
        break;
      case "left":
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.left - tooltipRect.width - spacing;
        break;
      case "right":
        top = triggerRect.top + (triggerRect.height - tooltipRect.height) / 2;
        left = triggerRect.right + spacing;
        break;
    }

    setPosition({ top, left });
  };

  const handleMouseEnter = () => {
    showTimeout = setTimeout(() => {
      setIsVisible(true);
      calculatePosition();
    }, delayDuration);
  };

  const handleMouseLeave = () => {
    clearTimeout(showTimeout);
    setIsVisible(false);
  };

  useEffect(() => {
    if (isVisible) {
      calculatePosition();
      window.addEventListener("scroll", calculatePosition);
      window.addEventListener("resize", calculatePosition);
    }

    return () => {
      window.removeEventListener("scroll", calculatePosition);
      window.removeEventListener("resize", calculatePosition);
    };
  }, [isVisible]);

  const variants = {
    initial: {
      opacity: 0,
      scale: 0.95,
      ...(side === "top" && { y: 2 }),
      ...(side === "bottom" && { y: -2 }),
      ...(side === "left" && { x: 2 }),
      ...(side === "right" && { x: -2 }),
    },
    animate: {
      opacity: 1,
      scale: 1,
      y: 0,
      x: 0,
    },
    exit: {
      opacity: 0,
      scale: 0.95,
      transition: { duration: 0.1 }
    }
  };

  return (
    <div
      ref={triggerRef}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      className="inline-block"
    >
      {children}
      <AnimatePresence>
        {isVisible && (
          <motion.div
            ref={tooltipRef}
            className={cn(
              "fixed z-50 rounded-md border bg-background border-border px-3 py-1.5",
              "text-sm text-text shadow-md",
              "dark:bg-background-dark dark:border-border-dark dark:text-text-light",
              className
            )}
            style={{
              top: position.top,
              left: position.left,
            }}
            initial="initial"
            animate="animate"
            exit="exit"
            variants={variants}
            transition={{ duration: 0.15 }}
          >
            {content}
            {showArrow && (
              <div
                className={cn(
                  "absolute w-0 h-0",
                  {
                    "top-[-10px] left-[calc(50%-10px)] border-l-[10px] border-r-[10px] border-b-[10px] border-l-transparent border-r-transparent border-t-transparent border-b-border dark:border-b-border-dark": side === "bottom",
                    
                    "bottom-[-10px] left-[calc(50%-10px)] border-l-[10px] border-r-[10px] border-t-[10px] border-l-transparent border-r-transparent border-b-transparent border-t-border dark:border-t-border-dark": side === "top",
                    
                    "right-[-10px] top-[calc(50%-10px)] border-t-[10px] border-b-[10px] border-l-[10px] border-t-transparent border-b-transparent border-r-transparent border-l-border dark:border-l-border-dark": side === "left",
                    
                    "left-[-10px] top-[calc(50%-10px)] border-t-[10px] border-b-[10px] border-r-[10px] border-t-transparent border-b-transparent border-l-transparent border-r-border dark:border-r-border-dark": side === "right"
                  }
                )}
              />
            )}
            {showArrow && (
              <div
                className={cn(
                  "absolute w-0 h-0",
                  {
                    "top-[-8px] left-[calc(50%-8px)] border-l-[8px] border-r-[8px] border-b-[8px] border-l-transparent border-r-transparent border-t-transparent border-b-background  dark:border-b-background-dark": side === "bottom",
                    
                    "bottom-[-8px] left-[calc(50%-8px)] border-l-[8px] border-r-[8px] border-t-[8px] border-l-transparent border-r-transparent border-b-transparent border-t-background  dark:border-t-background-dark ": side === "top",
                    
                    "right-[-8px] top-[calc(50%-8px)] border-t-[8px] border-b-[8px] border-l-[8px] border-t-transparent border-b-transparent border-r-transparent border-l-background dark:border-l-background-dark": side === "left",
                    
                    "left-[-8px] top-[calc(50%-8px)] border-t-[8px] border-b-[8px] border-r-[8px] border-t-transparent border-b-transparent border-l-transparent border-r-background dark:border-r-background-dark": side === "right"
                  }
                )}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export { Tooltip, type TooltipProps };
