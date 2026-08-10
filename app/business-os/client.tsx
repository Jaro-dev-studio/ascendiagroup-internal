"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import ROICalculator from "./roi-calculator";

gsap.registerPlugin(ScrollTrigger);

// Mobile detection helper
const isMobileDevice = () => {
  if (typeof window === "undefined") return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
};

export default function BusinessOSClient() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [isVideoModalOpen, setIsVideoModalOpen] = useState(false);

  // Mobile detection
  useEffect(() => {
    setIsMobile(isMobileDevice());
    
    const handleResize = () => {
      setIsMobile(isMobileDevice());
    };
    
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Prevent overscroll and configure ScrollTrigger for mobile
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    
    // Prevent overscroll behavior
    html.style.overscrollBehavior = "none";
    body.style.overscrollBehavior = "none";
    
    // Mobile-specific ScrollTrigger configuration
    if (isMobile) {
      // Normalize scroll for better touch handling on mobile
      ScrollTrigger.normalizeScroll(true);
      // Ignore mobile resize events (address bar show/hide)
      ScrollTrigger.config({ ignoreMobileResize: true });
    }
    
    return () => {
      html.style.overscrollBehavior = "";
      body.style.overscrollBehavior = "";
      if (isMobile) {
        ScrollTrigger.normalizeScroll(false);
      }
    };
  }, [isMobile]);

  // Scroll to next snap point (uses viewport height increments, GSAP snap handles the rest)
  const scrollToNextSnapPoint = useCallback(() => {
    const currentScroll = window.scrollY;
    const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
    
    // Scroll by viewport height - GSAP snap will handle snapping to the right position
    const nextPosition = Math.min(currentScroll + window.innerHeight, maxScroll);
    
    if (currentScroll >= maxScroll - 10) {
      return false; // Already at the end
    }
    
    window.scrollTo({
      top: nextPosition,
      behavior: "smooth",
    });
    return true;
  }, []);

  // Scroll to previous snap point
  const scrollToPrevSnapPoint = useCallback(() => {
    const currentScroll = window.scrollY;
    
    // Scroll back by viewport height
    const prevPosition = Math.max(currentScroll - window.innerHeight, 0);
    
    window.scrollTo({
      top: prevPosition,
      behavior: "smooth",
    });
  }, []);

  // Keyboard navigation (disabled on mobile as it's not relevant)
  useEffect(() => {
    // Skip keyboard navigation on mobile devices
    if (isMobile) return;
    
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown" || e.key === "PageDown") {
        e.preventDefault();
        scrollToNextSnapPoint();
      } else if (e.key === "ArrowUp" || e.key === "PageUp") {
        e.preventDefault();
        scrollToPrevSnapPoint();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [scrollToNextSnapPoint, scrollToPrevSnapPoint, isMobile]);

  // Close video modal on Escape key (global handler for when iframe has focus)
  useEffect(() => {
    if (!isVideoModalOpen) return;
    
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsVideoModalOpen(false);
      }
    };
    
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isVideoModalOpen]);

  useEffect(() => {
    const mobile = isMobileDevice();
    
    const ctx = gsap.context(() => {
      // Hero initial animation
      gsap.from(".hero-title", {
        y: mobile ? 50 : 100,
        opacity: 0,
        duration: 1.2,
        ease: "power4.out",
      });

      gsap.from(".scroll-hint", {
        opacity: 0,
        duration: 1,
        delay: 1.2,
        ease: "power2.out",
      });

      // BusinessOS Expansion Animation - expands "BusinessOS" to "Business Operating System"
      // Custom snap function for hero - only snap when very close
      const heroSnapThreshold = 0.08;
      const heroSnapPoints = [0, 1];
      const heroSnapToNearby = (progress: number) => {
        for (const point of heroSnapPoints) {
          if (Math.abs(progress - point) < heroSnapThreshold) {
            return point;
          }
        }
        return progress;
      };
      
      const heroExpansionTl = gsap.timeline({
        scrollTrigger: {
          trigger: ".hero-section",
          start: "top top",
          end: "+=100%",
          pin: true,
          pinSpacing: true,
          scrub: mobile ? 1 : 0.5,
          anticipatePin: 1,
          ...(mobile ? {} : {
            snap: {
              snapTo: heroSnapToNearby,
              duration: { min: 0.1, max: 0.3 },
              delay: 0,
              ease: "power1.out",
            },
          }),
        },
      });

      // Set initial state - hide expanded parts and spaces
      gsap.set(".operating-expanded", {
        width: 0,
        opacity: 0,
        display: "inline-block",
        verticalAlign: "baseline",
      });
      gsap.set(".system-expanded", {
        width: 0,
        opacity: 0,
        display: "inline-block",
        verticalAlign: "baseline",
      });
      gsap.set(".os-space", {
        width: 0,
        display: "inline-block",
      });
      gsap.set(".expansion-description", { 
        opacity: 0, 
        y: 20 
      });

      // Animation sequence - all animations complete within 0-1 progress
      heroExpansionTl
        // Add space after Business
        .to(".os-space", { 
          width: "0.3em", 
          duration: 0.15 
        }, 0.05)
        // Expand "O" to "Operating"
        .to(".operating-expanded", { 
          width: "auto", 
          opacity: 1, 
          duration: 0.2,
          ease: "power2.out"
        }, 0.1)
        // Expand "S" to "System"  
        .to(".system-expanded", { 
          width: "auto", 
          opacity: 1, 
          duration: 0.2,
          ease: "power2.out"
        }, 0.3)
        // Fade in the description
        .to(".expansion-description", { 
          opacity: 1, 
          y: 0, 
          duration: 0.2,
          ease: "power2.out"
        }, 0.5)
        // Hold at expanded state
        .to({}, { duration: 0.3 }, 0.7);

      // Scroll-triggered sections
      const sections = gsap.utils.toArray<HTMLElement>(".scroll-section");
      sections.forEach((section) => {
        const title = section.querySelector(".section-title");
        const text = section.querySelector(".section-text");
        const highlight = section.querySelector(".section-highlight");

        if (title) {
          gsap.from(title, {
            scrollTrigger: {
              trigger: section,
              start: "top 80%",
              end: "top 20%",
              scrub: 1,
            },
            y: 100,
            opacity: 0,
          });
        }

        if (text) {
          gsap.from(text, {
            scrollTrigger: {
              trigger: section,
              start: "top 70%",
              end: "top 30%",
              scrub: 1,
            },
            y: 80,
            opacity: 0,
          });
        }

        if (highlight) {
          gsap.from(highlight, {
            scrollTrigger: {
              trigger: section,
              start: "top 60%",
              end: "top 20%",
              scrub: 1,
            },
            scale: 0.8,
            opacity: 0,
          });
        }
      });

      // Pinned sections with animated content - with snap to each item
      const pinnedSections = gsap.utils.toArray<HTMLElement>(".pinned-section");
      pinnedSections.forEach((section) => {
        const items = section.querySelectorAll(".pinned-item");
        const numItems = items.length;

        // Create snap points array - one for each item's visible state
        const itemSnapPoints: number[] = [];
        for (let i = 0; i < numItems; i++) {
          // Each item is fully visible at (index + 0.5) / numItems progress
          itemSnapPoints.push((i + 0.5) / numItems);
        }
        // Also add 0 and 1 for start/end
        itemSnapPoints.unshift(0);
        itemSnapPoints.push(1);

        // Create a timeline for the pinned section
        // On mobile: disable snap and reduce pin duration
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: `+=${numItems * (mobile ? 80 : 100)}%`,
            pin: true,
            pinSpacing: true,
            scrub: mobile ? 1 : 0.5,
            anticipatePin: 1,
            // Disable snap on mobile
            ...(mobile ? {} : {
              snap: {
                snapTo: itemSnapPoints,
                duration: { min: 0.2, max: 0.4 },
                delay: 0,
                ease: "power1.inOut",
                directional: true,
              },
            }),
          },
        });

        // Animate each item in sequence
        items.forEach((item, index) => {
          // Set initial state
          gsap.set(item, { opacity: 0, y: 30 });

          // Add label for this item
          tl.addLabel(`item${index}`, index);

          // Fade in
          tl.to(
            item,
            {
              opacity: 1,
              y: 0,
              duration: 0.4,
              ease: "power2.out",
            },
            index
          );

          // Hold the item visible
          tl.to(item, { duration: 0.2 }, index + 0.4);

          // Fade out (except for last item)
          if (index < numItems - 1) {
            tl.to(
              item,
              {
                opacity: 0,
                y: -30,
                duration: 0.4,
                ease: "power2.in",
              },
              index + 0.6
            );
          }
        });
      });

      // Steps animation
      const steps = gsap.utils.toArray<HTMLElement>(".step-item");
      steps.forEach((step, index) => {
        gsap.from(step, {
          scrollTrigger: {
            trigger: step,
            start: "top 85%",
            end: "top 50%",
            scrub: 1,
          },
          x: index % 2 === 0 ? -100 : 100,
          opacity: 0,
        });
      });

      // List items stagger
      const lists = gsap.utils.toArray<HTMLElement>(".animate-list");
      lists.forEach((list) => {
        const items = list.querySelectorAll("li");
        gsap.from(items, {
          scrollTrigger: {
            trigger: list,
            start: "top 80%",
            end: "top 40%",
            scrub: 1,
          },
          y: 30,
          opacity: 0,
          stagger: 0.1,
        });
      });

      // Parallax backgrounds
      const parallaxBgs = gsap.utils.toArray<HTMLElement>(".parallax-bg");
      parallaxBgs.forEach((bg) => {
        gsap.to(bg, {
          scrollTrigger: {
            trigger: bg.parentElement,
            start: "top bottom",
            end: "bottom top",
            scrub: 1,
          },
          y: -100,
        });
      });

      // Counter animations
      const counters = gsap.utils.toArray<HTMLElement>(".counter");
      counters.forEach((counter) => {
        gsap.from(counter, {
          scrollTrigger: {
            trigger: counter,
            start: "top 80%",
          },
          textContent: 0,
          duration: 2,
          ease: "power2.out",
          snap: { textContent: 1 },
          onUpdate: function () {
            counter.textContent =
              Math.ceil(parseFloat(counter.textContent || "0")) + "%";
          },
        });
      });

      // Glow effect on scroll
      gsap.to(".glow-element", {
        scrollTrigger: {
          trigger: ".glow-section",
          start: "top center",
          end: "bottom center",
          scrub: 1,
        },
        boxShadow: "0 0 100px 20px rgba(14, 165, 233, 0.3)",
      });

      // Final CTA animation
      gsap.from(".final-cta", {
        scrollTrigger: {
          trigger: ".final-cta",
          start: "top 80%",
          end: "top 50%",
          scrub: 1,
        },
        scale: 0.9,
        opacity: 0,
      });

      // ROI Calculator animations
      const calculatorSection = document.querySelector(".calculator-section");
      if (calculatorSection) {
        // Header animation
        gsap.fromTo(".calculator-header", 
          {
            y: 60,
            opacity: 0,
          },
          {
            scrollTrigger: {
              trigger: ".calculator-section",
              start: "top 80%",
              end: "top 50%",
              scrub: 0.8,
            },
            y: 0,
            opacity: 1,
            ease: "power3.out",
          }
        );

        // Settings panel animation
        gsap.fromTo(".calculator-settings", 
          {
            y: 40,
            opacity: 0,
          },
          {
            scrollTrigger: {
              trigger: ".calculator-settings",
              start: "top 85%",
              end: "top 60%",
              scrub: 0.8,
            },
            y: 0,
            opacity: 1,
            ease: "power3.out",
          }
        );

        // Workflow cards stagger animation
        const workflowCards = document.querySelectorAll(".workflow-card");
        workflowCards.forEach((card, index) => {
          gsap.fromTo(card, 
            {
              y: 50,
              opacity: 0,
              scale: 0.95,
            },
            {
              scrollTrigger: {
                trigger: card,
                start: "top 90%",
                end: "top 65%",
                scrub: 0.8,
              },
              y: 0,
              opacity: 1,
              scale: 1,
              ease: "power3.out",
              delay: index * 0.05,
            }
          );
        });

        // Results panel animation
        gsap.fromTo(".calculator-results", 
          {
            y: 60,
            opacity: 0,
            scale: 0.98,
          },
          {
            scrollTrigger: {
              trigger: ".calculator-results",
              start: "top 85%",
              end: "top 55%",
              scrub: 0.8,
            },
            y: 0,
            opacity: 1,
            scale: 1,
            ease: "power3.out",
          }
        );
      }

      // Good Company slide - fade in then pin for a scroll stop (must be before problem slides since it's first in DOM)
      const goodCompanySlide = document.querySelector(".good-company-slide");
      if (goodCompanySlide) {
        const gcSlideTitle = goodCompanySlide.querySelector(".slide-title");
        const logosContainer = goodCompanySlide.querySelector(".logos-container");
        const watchButton = goodCompanySlide.querySelector(".watch-demo-btn");
        
        // Set initial states
        if (gcSlideTitle) {
          gsap.set(gcSlideTitle, { opacity: 0, y: 30 });
        }
        if (logosContainer) {
          gsap.set(logosContainer, { opacity: 0, y: 40 });
        }
        if (watchButton) {
          gsap.set(watchButton, { opacity: 0, y: 30 });
        }
        
        // Pin the section for a scroll stop - must be created first
        ScrollTrigger.create({
          trigger: ".good-company-slide",
          start: "top top",
          end: "+=100%",
          pin: true,
          pinSpacing: true,
        });
        
        // Create timeline - content fades in as you scroll into the section
        const fadeInTl = gsap.timeline({
          scrollTrigger: {
            trigger: ".good-company-slide",
            start: "top 80%",
            end: "top 20%",
            scrub: 0.5,
          },
        });
        
        // Staggered fade in
        fadeInTl
          .to(gcSlideTitle, {
            opacity: 1,
            y: 0,
            duration: 0.3,
            ease: "power2.out",
          }, 0)
          .to(logosContainer, {
            opacity: 1,
            y: 0,
            duration: 0.3,
            ease: "power2.out",
          }, 0.1)
          .to(watchButton, {
            opacity: 1,
            y: 0,
            duration: 0.3,
            ease: "power2.out",
          }, 0.2);
      }

      // Problem slides animations with snap
      const problemSlides = [
        ".problem-slide-1",
        ".problem-slide-2",
        ".problem-slide-3",
        ".problem-slide-4",
        ".problem-slide-6",
        ".problem-slide-7",
        ".solution-slide",
        ".how-it-works-slide",
      ];

      // Slide 2 special animation with chaos words
      const slide2 = document.querySelector(".problem-slide-2");
      if (slide2) {
        const chaosContainer = slide2.querySelector(".chaos-words-container");
        const chaosWords = slide2.querySelectorAll(".chaos-word");
        const slide2Title = slide2.querySelector(".slide-title");
        const slide2Subtitle = slide2.querySelector(".slide-subtitle");

        // Store random values for each word for consistent fly-in and fly-out
        const wordData: { inX: number; inY: number; inRotation: number; outX: number; outY: number; outRotation: number; finalScale: number }[] = [];
        
        chaosWords.forEach(() => {
          wordData.push({
            inX: (Math.random() - 0.5) * 1500,
            inY: (Math.random() - 0.5) * 1500,
            inRotation: (Math.random() - 0.5) * 360,
            outX: (Math.random() - 0.5) * 2000,
            outY: (Math.random() - 0.5) * 2000,
            outRotation: (Math.random() - 0.5) * 540,
            finalScale: 0.8 + Math.random() * 0.4,
          });
        });

        // Set initial state for chaos words (hidden off screen)
        chaosWords.forEach((word, index) => {
          const data = wordData[index];
          gsap.set(word, { x: data.inX, y: data.inY, rotation: data.inRotation, scale: 0, opacity: 0 });
        });
        
        // Hide chaos container initially
        gsap.set(chaosContainer, { opacity: 0 });

        // Fade in chaos container - starts at 100%
        gsap.to(chaosContainer, {
          scrollTrigger: {
            trigger: ".problem-slide-2",
            start: "top+=100% top",
            end: "top+=130% top",
            scrub: 0.3,
          },
          opacity: 1,
        });

        // Fade out title and subtitle when words fly away (starts slightly after words begin flying out)
        gsap.fromTo(slide2Title, 
          { opacity: 1 },
          {
            opacity: 0,
            scrollTrigger: {
              trigger: ".problem-slide-2",
              start: "top+=175% top",
              end: "top+=200% top",
              scrub: 0.5,
            },
            ease: "power2.out",
          }
        );
        
        gsap.fromTo(slide2Subtitle, 
          { opacity: 1 },
          {
            opacity: 0,
            scrollTrigger: {
              trigger: ".problem-slide-2",
              start: "top+=175% top",
              end: "top+=200% top",
              scrub: 0.5,
            },
            ease: "power2.out",
          }
        );

        // Animate each chaos word - fly in, hold, then fly out in a single timeline
        chaosWords.forEach((word, index) => {
          const data = wordData[index];
          const wobbleX = (Math.random() - 0.5) * 80;
          const wobbleY = (Math.random() - 0.5) * 80;
          const wobbleRotation = (Math.random() - 0.5) * 20;

          // Single timeline for entire word lifecycle
          const wordTl = gsap.timeline({
            scrollTrigger: {
              trigger: ".problem-slide-2",
              start: "top+=100% top",
              end: "top+=200% top",
              scrub: 1,
            },
          });

          // Fly in (0% to 50% of timeline)
          wordTl.to(word, {
            x: wobbleX,
            y: wobbleY,
            rotation: wobbleRotation,
            scale: data.finalScale,
            opacity: 1,
            duration: 0.5,
            ease: "power2.out",
          });

          // Hold briefly (50% to 60%)
          wordTl.to(word, {
            duration: 0.1,
          });

          // Fly out (60% to 100% of timeline)
          wordTl.to(word, {
            x: data.outX,
            y: data.outY,
            rotation: data.outRotation,
            scale: 0,
            opacity: 0,
            duration: 0.4,
            ease: "power2.in",
          });
        });
      }

      // Glass shatter overlay animation on slide 1
      const glassOverlay = document.querySelector(".glass-overlay");
      if (glassOverlay) {
        const shards = glassOverlay.querySelectorAll(".glass-shard");
        
        // Create shatter animation - each shard flies outward from center
        shards.forEach((shard, index) => {
          // Calculate angle based on shard position (radiating from center)
          const angle = (index / shards.length) * Math.PI * 2;
          const distance = 800 + Math.random() * 400;
          const xMove = Math.cos(angle) * distance;
          const yMove = Math.sin(angle) * distance;
          const rotation = (Math.random() - 0.5) * 360;
          
          gsap.to(shard, {
            scrollTrigger: {
              trigger: ".problem-slide-1",
              start: "top top",
              end: "+=90%",
              scrub: 1,
            },
            x: xMove,
            y: yMove,
            rotation: rotation,
            opacity: 0,
            scale: 0.5,
            ease: "power2.out",
          });
        });
      }

      // Set initial state for stamp (before any ScrollTrigger)
      const stampElement = document.querySelector(".problem-slide-3 .stamp-element");
      if (stampElement) {
        gsap.set(stampElement, { 
          opacity: 0, 
          rotation: -12, 
          scale: 1.5,
          transformOrigin: "center center"
        });
      }

      problemSlides.forEach((slideClass) => {
        const slide = document.querySelector(slideClass);
        if (!slide) return;

        // Slides 2, 3, 4, 6, 7, solution, and how-it-works get 200% pin for two-step scroll
        const isSlide1 = slideClass === ".problem-slide-1";
        const isSlide2 = slideClass === ".problem-slide-2";
        const isSlide3 = slideClass === ".problem-slide-3";
        const isSlide4 = slideClass === ".problem-slide-4";
        const isSlide6 = slideClass === ".problem-slide-6";
        const isSlide7 = slideClass === ".problem-slide-7";
        const isSolutionSlide = slideClass === ".solution-slide";
        const isHowItWorks = slideClass === ".how-it-works-slide";
        const hasTwoStepAnimation = isSlide2 || isSlide3 || isSlide4 || isSlide6 || isSlide7 || isSolutionSlide || isHowItWorks;
        // Reduce pin duration on mobile, slide 4 gets extra long for tape animation
        let pinEnd: string;
        if (isSlide4) {
          pinEnd = mobile ? "+=300%" : "+=400%";
        } else if (hasTwoStepAnimation) {
          pinEnd = mobile ? "+=150%" : "+=200%";
        } else {
          pinEnd = mobile ? "+=80%" : "+=100%";
        }

        // Snap points for two-step animations
        const snapPoints = hasTwoStepAnimation ? [0, 0.5, 1] : [0, 1];
        
        // Custom snap function - only snaps when very close to a stop point
        const snapThreshold = 0.08; // Only snap if within 8% of a snap point
        const snapToNearby = (progress: number) => {
          for (const point of snapPoints) {
            if (Math.abs(progress - point) < snapThreshold) {
              return point;
            }
          }
          return progress; // Don't snap if not close to any point
        };

        // Pin each slide with snap only when close to stop points
        gsap.timeline({
          scrollTrigger: {
            trigger: slideClass,
            start: "top top",
            end: pinEnd,
            pin: true,
            pinSpacing: true,
            scrub: mobile ? 1 : 0.5,
            anticipatePin: 1,
            // Snap only when close to a stop point
            ...(mobile ? {} : {
              snap: {
                snapTo: snapToNearby,
                duration: { min: 0.1, max: 0.3 },
                delay: 0,
                ease: "power1.out",
              },
            }),
          },
        });

        // Slide 3 stamp animation - triggers during the pinned second scroll
        if (isSlide3) {
          const stamp = slide.querySelector(".stamp-element");
          if (stamp) {
            // Create a timeline for the stamp animation during second half of pin
            const stampTimeline = gsap.timeline({
              scrollTrigger: {
                trigger: slideClass,
                start: "top top",
                end: "+=200%",
                scrub: 0.5,
              },
            });
            
            // Timeline: first 50% = nothing (title visible), then stamp appears with scale and fade only
            stampTimeline
              .to(stamp, { opacity: 0, rotation: -12, scale: 1.5, duration: 0.48 }) // Hold hidden
              .to(stamp, { opacity: 1, scale: 1.1, duration: 0.25, ease: "power4.in" }) // Fade in with slight scale
              .to(stamp, { scale: 0.95, duration: 0.08, ease: "power2.out" }) // Squish on impact
              .to(stamp, { scale: 1, duration: 0.19, ease: "elastic.out(1, 0.5)" }); // Settle with bounce
          }
        }

        // Slide 4 tape roll animation - rolls across then breaks, text splits too
        if (isSlide4) {
          const tapeStrip = slide.querySelector(".tape-strip");
          const tapeRoll = slide.querySelector(".tape-roll");
          const tapePieceLeft = slide.querySelector(".tape-piece-left");
          const tapePieceRight = slide.querySelector(".tape-piece-right");
          const textWhole = slide.querySelector(".slide4-text-whole");
          const textTop = slide.querySelector(".slide4-text-top");
          const textBottom = slide.querySelector(".slide4-text-bottom");
          
          if (tapeStrip && tapeRoll && tapePieceLeft && tapePieceRight && textWhole && textTop && textBottom) {
            // Set initial states - tape starts just off-screen to the right so roll is visible quickly
            gsap.set(tapeStrip, { left: "-210vw", opacity: 1 });
            gsap.set([tapePieceLeft, tapePieceRight], { opacity: 0, x: 0, y: 0 });
            gsap.set([textTop, textBottom], { opacity: 0, y: 0 });
            
            // Create timeline for tape animation - 400% scroll duration
            const tapeTl = gsap.timeline({
              scrollTrigger: {
                trigger: slideClass,
                start: "top top",
                end: "+=400%",
                scrub: 1,
              },
            });
            
            // Timeline: 0-60% roll across, 60-72% break, 72-100% hold
            tapeTl
              // Roll phase - roll enters from right side and goes all the way across
              .to(tapeStrip, { left: "-80vw", duration: 0.60, ease: "power1.inOut" })
              .to(tapeRoll, { rotation: 1080, duration: 0.60, ease: "power1.inOut" }, "<")
              // Break phase - tape hides, pieces appear, text splits
              .set(tapeStrip, { opacity: 0 })
              .set([tapePieceLeft, tapePieceRight], { opacity: 1 })
              .set(textWhole, { opacity: 0 })
              .set([textTop, textBottom], { opacity: 1 })
              // Pieces fly apart and fade out, text halves separate (doubled duration)
              .to(tapePieceLeft, { 
                x: "-80vw", 
                y: 300, 
                rotation: -75, 
                opacity: 0,
                duration: 0.24, 
                ease: "power2.out" 
              })
              .to(tapePieceRight, { 
                x: "80vw", 
                y: -300, 
                rotation: 75, 
                opacity: 0,
                duration: 0.24, 
                ease: "power2.out" 
              }, "<")
              // Text halves fly apart and fade out completely (doubled duration)
              .to(textTop, { 
                y: -150, 
                opacity: 0,
                duration: 0.24, 
                ease: "power2.in" 
              }, "<")
              .to(textBottom, { 
                y: 150, 
                opacity: 0,
                duration: 0.24, 
                ease: "power2.in" 
              }, "<")
              // Hold at end to ensure words fully disappear before scroll continues
              .to({}, { duration: 0.12 });
          }
        }

        // Slide 6 "breaks" falling animation - "aks" falls like gravity, pivoting from "e"
        if (isSlide6) {
          const breaksAks = slide.querySelector(".breaks-aks");
          
          if (breaksAks) {
            // Set initial state
            gsap.set(breaksAks, { rotation: 0 });
            
            // Create timeline for the falling animation
            const breaksTl = gsap.timeline({
              scrollTrigger: {
                trigger: slideClass,
                start: "top top",
                end: "+=200%",
                scrub: 0.8,
              },
            });
            
            // Timeline: first 50% = hold, then "aks" swings down like gravity with pendulum motion
            breaksTl
              // Hold phase - text stays normal for first 100% of scroll
              .to(breaksAks, { rotation: 0, duration: 0.50 })
              // Fall phase - "aks" swings down with gravity, overshoots past 90°
              .to(breaksAks, { 
                rotation: 115, 
                duration: 0.18, 
                ease: "power2.in" 
              })
              // Pendulum swings - oscillates around 90°, damping each time
              .to(breaksAks, { 
                rotation: 70, 
                duration: 0.10, 
                ease: "power1.inOut" 
              })
              .to(breaksAks, { 
                rotation: 105, 
                duration: 0.08, 
                ease: "power1.inOut" 
              })
              .to(breaksAks, { 
                rotation: 80, 
                duration: 0.06, 
                ease: "power1.inOut" 
              })
              .to(breaksAks, { 
                rotation: 95, 
                duration: 0.04, 
                ease: "power1.inOut" 
              })
              .to(breaksAks, { 
                rotation: 88, 
                duration: 0.04, 
                ease: "power1.inOut" 
              });
          }
        }

        // Slide 7 - sequential fade-in, words burn one by one, then full-screen fire
        if (isSlide7) {
          const item1 = slide.querySelector(".chaos-item-1");
          const item2 = slide.querySelector(".chaos-item-2");
          const item3 = slide.querySelector(".chaos-item-3");
          const burningWord1 = slide.querySelector(".burning-word");
          const burningWord2 = slide.querySelector(".burning-word-2");
          const burningWord3 = slide.querySelector(".burning-word-3");
          const burnOverlay = slide.querySelector(".burn-overlay");
          const burnBlack = slide.querySelector(".burn-black");
          const content = slide.querySelector(".slide7-content");
          
          if (item1 && item2 && item3 && burningWord1 && burningWord2 && burningWord3 && burnOverlay && burnBlack && content) {
            // Set initial states
            gsap.set([item1, item2, item3], { opacity: 0, y: 20 });
            gsap.set(burnOverlay, { opacity: 0 });
            gsap.set(burnBlack, { opacity: 0 });
            
            // Burning effect styles
            const burnStart = { 
              color: "#f59e0b",
              textShadow: "0 0 10px #ef4444, 0 0 20px #f59e0b, 0 0 30px #ef4444",
            };
            const burnIntense = { 
              color: "#ef4444",
              textShadow: "0 0 20px #ef4444, 0 0 40px #dc2626, 0 0 60px #ef4444, 0 0 80px #f59e0b",
              scale: 1.1,
            };
            
            // Create timeline
            const chaosTl = gsap.timeline({
              scrollTrigger: {
                trigger: slideClass,
                start: "top top",
                end: "+=200%",
                scrub: 0.8,
              },
            });
            
            chaosTl
              // Hold phase for first part
              .to({}, { duration: 0.05 })
              // Fade in items sequentially
              .to(item1, { opacity: 1, y: 0, duration: 0.06, ease: "power2.out" })
              .to(item2, { opacity: 1, y: 0, duration: 0.06, ease: "power2.out" })
              .to(item3, { opacity: 1, y: 0, duration: 0.06, ease: "power2.out" })
              // Hold to show all items
              .to({}, { duration: 0.08 })
              // "Burning" word catches fire first
              .to(burningWord1, { ...burnStart, duration: 0.04, ease: "power2.in" })
              .to(burningWord1, { ...burnIntense, duration: 0.03 })
              // "Killing" word catches fire
              .to(burningWord2, { ...burnStart, duration: 0.04, ease: "power2.in" }, "-=0.02")
              .to(burningWord2, { ...burnIntense, duration: 0.03 })
              // "Stalling" word catches fire  
              .to(burningWord3, { ...burnStart, duration: 0.04, ease: "power2.in" }, "-=0.02")
              .to(burningWord3, { ...burnIntense, duration: 0.03 })
              // Hold burning words
              .to({}, { duration: 0.06 })
              // Full-screen fire fades in
              .to(burnOverlay, { 
                opacity: 1, 
                duration: 0.15, 
                ease: "power2.in" 
              })
              // Content fades and blurs as fire engulfs
              .to(content, { 
                opacity: 0,
                filter: "blur(4px)",
                duration: 0.10 
              }, "<0.05")
              // Hold the fire effect
              .to({}, { duration: 0.06 })
              // Black fades in, consuming the fire
              .to(burnBlack, { 
                opacity: 1, 
                duration: 0.18, 
                ease: "power2.in" 
              })
              .to(burnOverlay, { 
                opacity: 0, 
                duration: 0.10 
              }, "<0.06");
          }
        }

        // Solution slide typewriter animation
        if (isSolutionSlide) {
          const titleChars = slide.querySelectorAll(".typewriter-char");
          const subtitleChars = slide.querySelectorAll(".typewriter-char-sub");
          const description = slide.querySelector(".slide-description");
          
          // Create typewriter timeline during pinned scroll
          const typewriterTl = gsap.timeline({
            scrollTrigger: {
              trigger: slideClass,
              start: "top top",
              end: "+=200%",
              scrub: 0.5,
            },
          });
          
          // Calculate timing - title chars take first 40%, subtitle 40-60%, description 60-70%, hold rest
          const totalTitleChars = titleChars.length;
          const totalSubtitleChars = subtitleChars.length;
          const charDuration = 0.35 / totalTitleChars; // Title takes 35% of scroll
          const subCharDuration = 0.15 / totalSubtitleChars; // Subtitle takes 15% of scroll
          
          // Animate title characters one by one
          titleChars.forEach((char, index) => {
            typewriterTl.to(char, {
              opacity: 1,
              duration: charDuration,
              ease: "none",
            }, index * charDuration * 0.8); // Slight overlap for smoother effect
          });
          
          // Animate subtitle characters after title (starting at ~40%)
          subtitleChars.forEach((char, index) => {
            typewriterTl.to(char, {
              opacity: 1,
              duration: subCharDuration,
              ease: "none",
            }, 0.40 + index * subCharDuration * 0.8);
          });
          
          // Fade in description after subtitle
          if (description) {
            typewriterTl.to(description, {
              opacity: 1,
              duration: 0.10,
              ease: "power2.out",
            }, 0.58);
          }
          
          // Hold for the rest
          typewriterTl.to({}, { duration: 0.30 });
        }

        // Animate slide content with beautiful Apple-style animations (skip solution slide - has typewriter)
        const title = slide.querySelector(".slide-title");
        const subtitle = slide.querySelector(".slide-subtitle");
        const description = slide.querySelector(".slide-description");
        const list = slide.querySelector(".slide-list");

        if (title && !isSolutionSlide) {
          gsap.fromTo(title, 
            {
              y: 80,
              opacity: 0,
              scale: 0.95,
              filter: "blur(10px)",
            },
            {
              scrollTrigger: {
                trigger: slideClass,
                start: "top 85%",
                end: "top 40%",
                scrub: 0.8,
              },
              y: 0,
              opacity: 1,
              scale: 1,
              filter: "blur(0px)",
              ease: "power3.out",
            }
          );
        }

        if (subtitle && !isSolutionSlide) {
          gsap.fromTo(subtitle, 
            {
              y: 60,
              opacity: 0,
              scale: 0.95,
              filter: "blur(8px)",
            },
            {
              scrollTrigger: {
                trigger: slideClass,
                start: "top 75%",
                end: "top 35%",
                scrub: 0.8,
              },
              y: 0,
              opacity: 1,
              scale: 1,
              filter: "blur(0px)",
              ease: "power3.out",
            }
          );
        }

        if (description && !isSolutionSlide) {
          gsap.fromTo(description, 
            {
              y: 40,
              opacity: 0,
              filter: "blur(6px)",
            },
            {
              scrollTrigger: {
                trigger: slideClass,
                start: "top 65%",
                end: "top 30%",
                scrub: 0.8,
              },
              y: 0,
              opacity: 1,
              filter: "blur(0px)",
              ease: "power3.out",
            }
          );
        }

        if (list) {
          const items = list.querySelectorAll("li");
          items.forEach((item, index) => {
            gsap.fromTo(item, 
              {
                y: 30,
                opacity: 0,
                x: -20,
                filter: "blur(4px)",
              },
              {
                scrollTrigger: {
                  trigger: slideClass,
                  start: `top ${70 - index * 5}%`,
                  end: `top ${35 - index * 5}%`,
                  scrub: 0.8,
                },
                y: 0,
                opacity: 1,
                x: 0,
                filter: "blur(0px)",
                ease: "power3.out",
              }
            );
          });
        }
      });

      // How It Works - animate step cards individually during pinned scroll
      const stepCards = document.querySelectorAll(".step-card");
      const numSteps = stepCards.length;
      
      if (numSteps > 0) {
        // Set initial state for all cards
        stepCards.forEach((card) => {
          gsap.set(card, { opacity: 0, y: 50, scale: 0.9 });
          const icon = card.querySelector(".step-icon");
          if (icon) {
            gsap.set(icon, { scale: 0, rotation: -180 });
          }
        });
        
        // Create timeline for sequential card reveals during pin
        const stepsTl = gsap.timeline({
          scrollTrigger: {
            trigger: ".how-it-works-slide",
            start: "top top",
            end: "+=200%",
            scrub: 0.8,
          },
        });
        
        // Calculate timing - each card gets equal portion of the scroll
        const cardDuration = 0.8 / numSteps; // 80% for cards, 20% hold at end
        
        stepCards.forEach((card, index) => {
          const startTime = index * cardDuration;
          const icon = card.querySelector(".step-icon");
          
          // Card fades in
          stepsTl.to(card, {
            opacity: 1,
            y: 0,
            scale: 1,
            duration: cardDuration * 0.8,
            ease: "power2.out",
          }, startTime);
          
          // Icon spins in slightly after card starts
          if (icon) {
            stepsTl.to(icon, {
              scale: 1,
              rotation: 0,
              duration: cardDuration * 0.6,
              ease: "back.out(1.7)",
            }, startTime + cardDuration * 0.2);
          }
        });
        
        // Hold at end
        stepsTl.to({}, { duration: 0.2 });
      }
    }, containerRef);

    return () => ctx.revert();
  }, []);

  return (
    <div
      ref={containerRef}
      className={`dark min-h-screen overflow-x-hidden bg-black ${isMobile ? "gsap-normalized-scroll" : ""}`}
    >
      {/* Fixed Navbar */}
      <nav className="fixed inset-x-0 top-0 z-50 flex items-center justify-between px-8 py-6">
        <div className="flex items-center gap-2">
          <Image
            src="/logo.png"
            alt="Jaro.dev"
            width={32}
            height={32}
            className="rounded"
          />
        </div>
        <Link
          href="#calculator"
          className="flex items-center gap-1.5 text-sm font-medium text-white underline underline-offset-4 transition-colors hover:text-neutral-300"
        >
          <span className="text-primary-400">$</span>
          ROI Calculator
        </Link>
      </nav>

      {/* Hero Section with BusinessOS Expansion */}
      <section className="hero-section relative flex min-h-screen flex-col items-center justify-center px-6">
        <div className="parallax-bg absolute inset-0 opacity-20">
          <div className="absolute left-1/4 top-1/4 size-96 rounded-full bg-primary-500 blur-[150px]" />
          <div className="absolute bottom-1/4 right-1/4 size-96 rounded-full bg-primary-700 blur-[150px]" />
        </div>

        <div className="relative z-10 max-w-6xl text-center">
          <h1 className="hero-title mb-8 flex flex-wrap items-baseline justify-center text-4xl font-bold leading-normal tracking-tight text-white md:text-6xl lg:text-7xl">
            {/* Collapsed: BusinessOS → Expanded: Business Operating System */}
            <span className="business-word">Business</span>
            <span className="os-space inline-block" style={{ width: 0 }}> </span>
            <span className="operating-letter">O</span>
            <span className="operating-expanded inline-block overflow-x-clip align-baseline" style={{ width: 0, opacity: 0 }}>perating</span>
            <span className="os-space inline-block" style={{ width: 0 }}> </span>
            <span className="system-letter">S</span>
            <span className="system-expanded inline-block overflow-x-clip align-baseline" style={{ width: 0, opacity: 0 }}>ystem</span>
            <span className="trademark-symbol text-sm text-primary-400 md:text-base">©</span>
          </h1>
          
          <p className="expansion-description mx-auto max-w-2xl text-xl text-neutral-400 md:text-2xl" style={{ opacity: 0, transform: "translateY(20px)" }}>
            The custom-tailored software that runs your business while you sleep.
          </p>
        
        </div>

        <div className="absolute bottom-12 flex flex-col items-center gap-3">
          <p className="scroll-hint text-sm font-medium uppercase tracking-widest text-neutral-500">
            Scroll down to continue
          </p>
          <div className="scroll-arrow animate-bounce">
            <svg
              className="size-8 text-neutral-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </div>
        </div>
      </section>

      {/* You're In Good Company Section */}
      <section className="good-company-slide relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-6">
        {/* Subtle ambient glow */}
        <div className="absolute inset-0">
          <div className="absolute left-1/2 top-0 size-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-600/20 blur-[180px]" />
          <div className="absolute left-1/2 top-1/2 size-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/[0.02] blur-[100px]" />
        </div>
        
        <div className="relative z-10 flex max-w-5xl flex-col items-center gap-12 text-center">
          {/* Title */}
          <p className="slide-title text-lg font-medium uppercase tracking-[0.3em] text-neutral-500 md:text-xl">
            Trusted by the most forward-thinking companies
          </p>
          
          {/* Logos */}
          <div className="logos-container flex flex-col items-center gap-16 md:flex-row md:gap-24">
            <Image
              src="/logos/openai.png"
              alt="OpenAI"
              width={200}
              height={80}
              className="h-14 w-auto brightness-0 invert md:h-20"
            />
            <Image
              src="/logos/chase.png"
              alt="JPMorgan Chase"
              width={240}
              height={80}
              className="h-12 w-auto brightness-0 invert md:h-16"
            />
          </div>
        </div>
      </section>

      {/* Slide 1: Your Business is Growing - with Glass Shatter Overlay */}
      <section className="problem-slide-1 relative flex min-h-screen items-center justify-center overflow-hidden px-6">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute right-1/4 top-1/3 size-96 rounded-full bg-danger-500 blur-[150px]" />
        </div>
        <div className="relative z-10 max-w-4xl text-center">
          <h2 className="slide-title mb-6 text-4xl font-bold leading-tight text-white md:text-5xl lg:text-6xl">
            Your Business is Growing.
          </h2>
          <p className="slide-subtitle text-3xl font-bold text-danger-400 md:text-4xl lg:text-5xl">
            But Your Operations Are Breaking.
          </p>
        </div>
        
        {/* Glass Shatter Overlay - shards radiate from center, blurs content behind */}
        <div className="glass-overlay pointer-events-none absolute inset-0 z-30">
          {/* Each shard is a div with backdrop-blur and clip-path */}
          {/* Top shards */}
          <div className="glass-shard absolute inset-0 border border-white/30 bg-white/10 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 0% 0%, 25% 0%)" }} />
          <div className="glass-shard absolute inset-0 border border-white/25 bg-white/5 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 25% 0%, 50% 0%)" }} />
          <div className="glass-shard absolute inset-0 border border-white/30 bg-white/10 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 50% 0%, 75% 0%)" }} />
          <div className="glass-shard absolute inset-0 border border-white/25 bg-white/5 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 75% 0%, 100% 0%)" }} />
          
          {/* Right shards */}
          <div className="glass-shard absolute inset-0 border border-white/30 bg-white/10 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 100% 0%, 100% 25%)" }} />
          <div className="glass-shard absolute inset-0 border border-white/25 bg-white/5 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 100% 25%, 100% 50%)" }} />
          <div className="glass-shard absolute inset-0 border border-white/30 bg-white/10 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 100% 50%, 100% 75%)" }} />
          <div className="glass-shard absolute inset-0 border border-white/25 bg-white/5 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 100% 75%, 100% 100%)" }} />
          
          {/* Bottom shards */}
          <div className="glass-shard absolute inset-0 border border-white/30 bg-white/10 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 100% 100%, 75% 100%)" }} />
          <div className="glass-shard absolute inset-0 border border-white/25 bg-white/5 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 75% 100%, 50% 100%)" }} />
          <div className="glass-shard absolute inset-0 border border-white/30 bg-white/10 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 50% 100%, 25% 100%)" }} />
          <div className="glass-shard absolute inset-0 border border-white/25 bg-white/5 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 25% 100%, 0% 100%)" }} />
          
          {/* Left shards */}
          <div className="glass-shard absolute inset-0 border border-white/30 bg-white/10 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 0% 100%, 0% 75%)" }} />
          <div className="glass-shard absolute inset-0 border border-white/25 bg-white/5 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 0% 75%, 0% 50%)" }} />
          <div className="glass-shard absolute inset-0 border border-white/30 bg-white/10 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 0% 50%, 0% 25%)" }} />
          <div className="glass-shard absolute inset-0 border border-white/25 bg-white/5 backdrop-blur-md" style={{ clipPath: "polygon(50% 50%, 0% 25%, 0% 0%)" }} />
        </div>
      </section>

      {/* Slide 2: Plateau from Chaos - with chaos words animation */}
      <section className="problem-slide-2 relative flex min-h-screen items-center justify-center overflow-visible px-6">
        <div className="absolute -inset-y-48 inset-x-0 opacity-15">
          <div className="absolute left-1/3 top-1/2 size-96 rounded-full bg-warning-500 blur-[150px]" />
          {/* Extend gradient down into next slide */}
          <div className="absolute bottom-0 left-1/4 size-80 rounded-full bg-warning-500 opacity-70 blur-[200px]" />
        </div>
        <div className="relative z-10 max-w-4xl text-center">
          <h2 className="slide-title text-3xl font-bold text-white md:text-4xl lg:text-5xl">
            Scaling Businesses
          </h2>
          <p className="slide-subtitle mt-4 text-2xl text-white/90 md:text-3xl">
            suffer from <span className="font-bold text-warning-400">operational chaos</span>.
          </p>
        </div>
        
        {/* Chaos words overlay - circular arrangement around the title */}
        <div className="chaos-words-container pointer-events-none absolute inset-0 z-20 opacity-0">
          {/* Outer ring - top */}
          <span className="chaos-word absolute text-xs text-white/40" style={{ left: "5%", top: "12%" }}>budget_v3_FINAL.xlsx</span>
          <span className="chaos-word absolute text-xs text-warning-400/50" style={{ left: "25%", top: "10%" }}>Copy of report.docx</span>
          <span className="chaos-word absolute text-xs text-white/40" style={{ left: "48%", top: "8%" }}>final_ACTUALLY_final.xlsx</span>
          <span className="chaos-word absolute text-xs text-warning-400/40" style={{ left: "72%", top: "10%" }}>notes_IMPORTANT.docx</span>
          <span className="chaos-word absolute text-xs text-white/40" style={{ left: "88%", top: "12%" }}>Dec2024_v4.xlsx</span>
          
          {/* Top arc */}
          <span className="chaos-word absolute text-lg font-bold text-white/70" style={{ left: "15%", top: "25%" }}>URGENT</span>
          <span className="chaos-word absolute text-sm text-danger-400/80" style={{ left: "35%", top: "22%" }}>DEADLINE</span>
          <span className="chaos-word absolute text-xl text-white/60" style={{ left: "50%", top: "20%" }}>invoice</span>
          <span className="chaos-word absolute text-lg text-white/60" style={{ left: "65%", top: "22%" }}>approval</span>
          <span className="chaos-word absolute text-base text-warning-400/60" style={{ left: "82%", top: "25%" }}>delay</span>
          
          {/* Upper sides */}
          <span className="chaos-word absolute text-lg text-warning-400/70" style={{ left: "8%", top: "32%" }}>follow up</span>
          <span className="chaos-word absolute text-xs text-white/40" style={{ left: "25%", top: "30%" }}>Untitled(23).xlsx</span>
          <span className="chaos-word absolute text-xs text-warning-400/40" style={{ left: "72%", top: "30%" }}>final_v2_mike.docx</span>
          <span className="chaos-word absolute text-base text-white/50" style={{ left: "88%", top: "32%" }}>checklist</span>
          
          {/* Left side */}
          <span className="chaos-word absolute text-lg text-white/50" style={{ left: "5%", top: "40%" }}>spreadsheet</span>
          <span className="chaos-word absolute text-xs text-white/40" style={{ left: "2%", top: "45%" }}>data_backup_OLD.csv</span>
          <span className="chaos-word absolute text-sm text-white/50" style={{ left: "3%", top: "50%" }}>report</span>
          <span className="chaos-word absolute text-xs text-warning-400/40" style={{ left: "2%", top: "55%" }}>USE_THIS_ONE.pptx</span>
          <span className="chaos-word absolute text-xl font-bold text-white/80" style={{ left: "5%", top: "60%" }}>HELP</span>
          
          {/* Right side */}
          <span className="chaos-word absolute text-sm font-bold text-danger-400/70" style={{ left: "90%", top: "40%" }}>OVERDUE</span>
          <span className="chaos-word absolute text-xs text-white/40" style={{ left: "88%", top: "45%" }}>Copy of Copy of.xlsx</span>
          <span className="chaos-word absolute text-lg text-white/70" style={{ left: "92%", top: "50%" }}>email</span>
          <span className="chaos-word absolute text-xs text-warning-400/40" style={{ left: "88%", top: "55%" }}>DONT_DELETE.txt</span>
          <span className="chaos-word absolute text-sm font-bold text-danger-400/80" style={{ left: "90%", top: "60%" }}>!!!</span>
          
          {/* Lower sides */}
          <span className="chaos-word absolute text-lg text-danger-400/60" style={{ left: "8%", top: "68%" }}>broken</span>
          <span className="chaos-word absolute text-xs text-white/40" style={{ left: "25%", top: "70%" }}>report_REAL_final.xlsx</span>
          <span className="chaos-word absolute text-xs text-warning-400/40" style={{ left: "72%", top: "70%" }}>invoice_dec_v3.pdf</span>
          <span className="chaos-word absolute text-sm text-white/70" style={{ left: "88%", top: "68%" }}>handoff</span>
          
          {/* Bottom arc */}
          <span className="chaos-word absolute text-xl font-bold text-warning-400/70" style={{ left: "15%", top: "75%" }}>ASAP!!!</span>
          <span className="chaos-word absolute text-base text-white/60" style={{ left: "30%", top: "78%" }}>meeting</span>
          <span className="chaos-word absolute text-base text-warning-400/60" style={{ left: "45%", top: "80%" }}>where's the file?</span>
          <span className="chaos-word absolute text-sm text-warning-400/60" style={{ left: "62%", top: "78%" }}>pending</span>
          <span className="chaos-word absolute text-xl text-warning-400/80" style={{ left: "80%", top: "75%" }}>WHERE?!</span>
          
          {/* Outer ring - bottom */}
          <span className="chaos-word absolute text-xs text-white/40" style={{ left: "5%", top: "85%" }}>final_final_v2.docx</span>
          <span className="chaos-word absolute text-xs text-warning-400/50" style={{ left: "22%", top: "88%" }}>LATEST_VERSION!!.pptx</span>
          <span className="chaos-word absolute text-xs text-white/40" style={{ left: "42%", top: "90%" }}>budget_REAL_final.xlsx</span>
          <span className="chaos-word absolute text-xs text-warning-400/40" style={{ left: "62%", top: "88%" }}>Untitled document.docx</span>
          <span className="chaos-word absolute text-xs text-white/40" style={{ left: "82%", top: "85%" }}>data_mike_edit.csv</span>
          
          {/* Extra scattered words */}
          <span className="chaos-word absolute text-base text-white/60" style={{ left: "20%", top: "35%" }}>slack</span>
          <span className="chaos-word absolute text-sm text-white/50" style={{ left: "78%", top: "35%" }}>sync</span>
          <span className="chaos-word absolute text-lg text-white/60" style={{ left: "20%", top: "65%" }}>docs</span>
          <span className="chaos-word absolute text-sm text-white/50" style={{ left: "78%", top: "65%" }}>task</span>
          <span className="chaos-word absolute text-xs text-white/40" style={{ left: "12%", top: "18%" }}>version?</span>
          <span className="chaos-word absolute text-xs text-danger-400/50" style={{ left: "85%", top: "18%" }}>CRITICAL</span>
          <span className="chaos-word absolute text-xs text-white/40" style={{ left: "12%", top: "82%" }}>outdated</span>
          <span className="chaos-word absolute text-xs text-danger-400/50" style={{ left: "85%", top: "82%" }}>ERROR</span>
        </div>
      </section>

      {/* Slide 3: Manual Workflows - with stamp animation */}
      <section className="problem-slide-3 relative flex min-h-screen items-center justify-center overflow-visible px-6">
        <div className="absolute -inset-y-48 inset-x-0 opacity-15">
          {/* Blend from slide 2's warning gradient - extends up */}
          <div className="absolute -top-24 left-1/4 size-80 rounded-full bg-warning-500 opacity-50 blur-[200px]" />
          <div className="absolute right-1/3 top-1/3 size-80 rounded-full bg-neutral-400 blur-[120px]" />
        </div>
        <div className="relative z-10 max-w-4xl text-center">
          <h2 className="slide-title text-3xl font-bold text-white md:text-4xl lg:text-5xl">
            Undocumented Manual Workflows
          </h2>
        </div>
        
        {/* Stamp overlay */}
        <div className="stamp-container pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
          <div className="stamp-element opacity-0">
            <div className="relative flex items-center justify-center">
              {/* Outer stamp border */}
              <div className="rounded-lg border-[6px] border-danger-500 bg-neutral-950/80 px-10 py-5 shadow-2xl md:px-16 md:py-8">
                <span className="stamp-text text-5xl font-black uppercase tracking-[0.2em] text-danger-500 drop-shadow-lg md:text-7xl lg:text-8xl">
                  NO THANKS
                </span>
              </div>
              {/* Stamp worn texture overlay */}
              <div className="absolute inset-0 rounded-lg opacity-20" style={{ background: "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E\")" }} />
            </div>
          </div>
        </div>
      </section>

      {/* Slide 4: Tools Duct-taped - with tape roll animation */}
      <section className="problem-slide-4 relative flex min-h-screen items-center justify-center overflow-hidden px-6">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute bottom-1/3 left-1/4 size-80 rounded-full bg-neutral-400 blur-[120px]" />
        </div>
        {/* Text container with split halves for break animation */}
        <div className="relative z-10 max-w-4xl text-center">
          {/* Original text - visible before break */}
          <h2 className="slide-title slide4-text-whole text-3xl font-bold text-white md:text-4xl lg:text-5xl">
            Tools <span className="text-white/80">duct-taped</span> together
          </h2>
          {/* Top half of text - for break animation */}
          <h2 
            className="slide4-text-top absolute inset-0 text-3xl font-bold text-white opacity-0 md:text-4xl lg:text-5xl"
            style={{ clipPath: "inset(0 0 50% 0)" }}
          >
            Tools <span className="text-white/80">duct-taped</span> together
          </h2>
          {/* Bottom half of text - for break animation */}
          <h2 
            className="slide4-text-bottom absolute inset-0 text-3xl font-bold text-white opacity-0 md:text-4xl lg:text-5xl"
            style={{ clipPath: "inset(50% 0 0 0)" }}
          >
            Tools <span className="text-white/80">duct-taped</span> together
          </h2>
        </div>
        
        {/* Tape roll animation overlay */}
        <div className="tape-container pointer-events-none absolute inset-0 z-20 overflow-hidden">
          {/* The tape strip that rolls across - roll leads, tape trails behind to the left */}
          <div className="tape-strip absolute top-1/2 flex -translate-y-1/2 items-center" style={{ left: "-210vw" }}>
            {/* Tape strip extending to the LEFT (trailing behind the roll) */}
            <div className="tape-body relative h-10 w-[200vw] md:h-14">
              {/* Main tape - silver duct tape color */}
              <div className="absolute inset-0 bg-gradient-to-b from-neutral-300 via-neutral-400 to-neutral-300 opacity-90" />
              {/* Tape texture - fabric weave pattern */}
              <div className="absolute inset-0 opacity-20" style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px), repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.1) 2px, rgba(0,0,0,0.1) 4px)" }} />
              {/* Tape shine */}
              <div className="absolute inset-x-0 top-0 h-2 bg-gradient-to-b from-white/40 to-transparent" />
              {/* Bottom edge shadow */}
              <div className="absolute inset-x-0 bottom-0 h-1 bg-gradient-to-t from-black/20 to-transparent" />
            </div>
            
            {/* Tape roll - TOP DOWN VIEW (at the leading/right edge) */}
            <div className="tape-roll relative z-10 -ml-6 flex size-20 shrink-0 items-center justify-center md:-ml-8 md:size-28">
              {/* Outer ring - tape wound around */}
              <div className="absolute size-full rounded-full bg-gradient-to-br from-neutral-300 via-neutral-400 to-neutral-500 shadow-xl" />
              {/* Tape layers visible from top */}
              <div className="absolute size-[90%] rounded-full bg-gradient-to-br from-neutral-400 to-neutral-500" style={{ boxShadow: "inset 0 2px 4px rgba(255,255,255,0.3), inset 0 -2px 4px rgba(0,0,0,0.2)" }} />
              <div className="absolute size-4/5 rounded-full bg-gradient-to-br from-neutral-300 via-neutral-400 to-neutral-500" />
              <div className="absolute size-[70%] rounded-full bg-gradient-to-br from-neutral-400 to-neutral-500" />
              {/* Inner cardboard core */}
              <div className="from-amber-700 via-amber-800 to-amber-900 absolute size-2/5 rounded-full bg-gradient-to-br shadow-inner md:size-[35%]" />
              <div className="from-amber-900 to-amber-950 absolute size-[30%] rounded-full bg-gradient-to-br md:size-[25%]" />
              {/* Center hole */}
              <div className="absolute size-1/5 rounded-full bg-neutral-950 md:size-[15%]" />
              {/* Highlight reflection */}
              <div className="absolute left-[15%] top-[15%] size-1/5 rounded-full bg-white/30 blur-sm" />
            </div>
          </div>
          
          {/* Broken tape pieces (initially hidden) - positioned at center where break happens */}
          <div className="tape-piece-left absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0">
            <div className="relative h-10 w-48 md:h-14 md:w-64">
              <div className="absolute inset-0 bg-gradient-to-b from-neutral-300 via-neutral-400 to-neutral-300 opacity-90" style={{ clipPath: "polygon(0 0, 100% 10%, 98% 90%, 0 100%)" }} />
              <div className="absolute inset-0 opacity-20" style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)" }} />
            </div>
          </div>
          <div className="tape-piece-right absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 opacity-0">
            <div className="relative h-10 w-48 md:h-14 md:w-64">
              <div className="absolute inset-0 bg-gradient-to-b from-neutral-300 via-neutral-400 to-neutral-300 opacity-90" style={{ clipPath: "polygon(2% 10%, 100% 0, 100% 100%, 0 90%)" }} />
              <div className="absolute inset-0 opacity-20" style={{ background: "repeating-linear-gradient(90deg, transparent, transparent 2px, rgba(0,0,0,0.15) 2px, rgba(0,0,0,0.15) 4px)" }} />
            </div>
          </div>
        </div>
      </section>

      {/* Slide 5: Someone Leaves - with "breaks" falling animation */}
      <section className="problem-slide-6 relative flex min-h-screen items-center justify-center overflow-hidden px-6">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute left-1/2 top-1/3 size-96 rounded-full bg-danger-500 blur-[150px]" />
        </div>
        <div className="relative z-10 max-w-4xl text-center">
          <h2 className="slide-title text-3xl font-bold text-white md:text-4xl lg:text-5xl">
            And when someone leaves?
          </h2>
          <p className="slide-subtitle mt-4 text-3xl font-bold text-danger-400 md:text-4xl">
            Something always{" "}
            {/* "breaks" split into parts for animation */}
            <span className="breaks-word relative inline-block">
              {/* "bre" stays in place - has the nail/pivot */}
              <span className="breaks-bre inline-block">bre</span>
              {/* "aks" falls down, pivoting from the connection to "e" */}
              <span 
                className="breaks-aks inline-block origin-top-left"
                style={{ transformOrigin: "left center" }}
              >aks</span>
            </span>
          </p>
        </div>
      </section>

      {/* Slide 7: Chaos Compounds - with sequential fade-in and full-screen burn */}
      <section className="problem-slide-7 relative flex min-h-screen items-center justify-center overflow-hidden px-6">
        <div className="absolute inset-0 opacity-15">
          <div className="absolute bottom-1/3 left-1/3 size-96 rounded-full bg-warning-500 blur-[150px]" />
        </div>
        <div className="slide7-content relative z-10 max-w-4xl text-center">
          <h2 className="slide-title slide7-title mb-6 text-2xl font-bold text-white md:text-3xl lg:text-4xl">
            Every day this chaos compounds:
          </h2>
          <ul className="slide-list flex flex-col gap-4 text-xl text-white md:text-2xl">
            <li className="chaos-item-1 flex items-center justify-center gap-3 opacity-0">
              <span className="text-danger-400">●</span> 
              <span className="burning-word inline-block">Burning</span> time
            </li>
            <li className="chaos-item-2 flex items-center justify-center gap-3 opacity-0">
              <span className="text-warning-400">●</span> 
              <span className="burning-word-2 inline-block">Killing</span> margin
            </li>
            <li className="chaos-item-3 flex items-center justify-center gap-3 opacity-0">
              <span className="text-white/60">●</span> 
              <span className="burning-word-3 inline-block">Stalling</span> growth
            </li>
          </ul>
        </div>
        
        {/* Full-screen burn overlay with realistic fire */}
        <div className="burn-overlay pointer-events-none absolute inset-0 z-20 opacity-0">
          {/* Base fire glow */}
          <div className="absolute inset-0 bg-gradient-to-t from-danger-900 via-warning-600 to-warning-400" />
          {/* Animated flame layers */}
          <div className="flame-layer-1 absolute inset-0 bg-gradient-to-t from-danger-700 via-warning-500 to-transparent opacity-90" 
            style={{ animation: "fireFlicker1 0.15s ease-in-out infinite alternate" }} />
          <div className="flame-layer-2 absolute inset-0 bg-gradient-to-t from-warning-600 via-danger-500 to-transparent opacity-70" 
            style={{ animation: "fireFlicker2 0.2s ease-in-out infinite alternate" }} />
          <div className="flame-layer-3 absolute inset-0 bg-gradient-to-t from-danger-600 via-warning-400 to-transparent opacity-60" 
            style={{ animation: "fireFlicker3 0.12s ease-in-out infinite alternate" }} />
          {/* Fire particles/embers - larger with glowing shadows */}
          <div className="fire-particles absolute inset-0 z-10 overflow-hidden">
            <div className="ember absolute bottom-0 left-[10%] size-3 rounded-full bg-warning-400" 
              style={{ animation: "emberRise 2s ease-out infinite", animationDelay: "0s", boxShadow: "0 0 8px 4px #f59e0b, 0 0 16px 8px #ef4444" }} />
            <div className="ember absolute bottom-0 left-[20%] size-2 rounded-full bg-danger-400" 
              style={{ animation: "emberRise 2.5s ease-out infinite", animationDelay: "0.4s", boxShadow: "0 0 6px 3px #ef4444, 0 0 12px 6px #dc2626" }} />
            <div className="ember absolute bottom-0 left-[35%] size-4 rounded-full bg-warning-300" 
              style={{ animation: "emberRise 1.8s ease-out infinite", animationDelay: "0.2s", boxShadow: "0 0 10px 5px #fbbf24, 0 0 20px 10px #f59e0b" }} />
            <div className="ember absolute bottom-0 left-[50%] size-2.5 rounded-full bg-danger-500" 
              style={{ animation: "emberRise 2.8s ease-out infinite", animationDelay: "0.6s", boxShadow: "0 0 6px 3px #dc2626, 0 0 12px 6px #b91c1c" }} />
            <div className="ember absolute bottom-0 left-[65%] size-3 rounded-full bg-warning-400" 
              style={{ animation: "emberRise 2.2s ease-out infinite", animationDelay: "0.3s", boxShadow: "0 0 8px 4px #f59e0b, 0 0 16px 8px #ef4444" }} />
            <div className="ember absolute bottom-0 left-[80%] size-2 rounded-full bg-danger-400" 
              style={{ animation: "emberRise 2s ease-out infinite", animationDelay: "0.5s", boxShadow: "0 0 6px 3px #ef4444, 0 0 12px 6px #dc2626" }} />
            <div className="ember absolute bottom-0 left-[90%] size-3.5 rounded-full bg-warning-500" 
              style={{ animation: "emberRise 2.4s ease-out infinite", animationDelay: "0.1s", boxShadow: "0 0 8px 4px #eab308, 0 0 16px 8px #f59e0b" }} />
          </div>
          {/* Heat distortion overlay */}
          <div className="absolute inset-0 bg-gradient-radial from-transparent via-danger-900/30 to-danger-950/50" />
        </div>
        
        {/* Black fade overlay */}
        <div className="burn-black pointer-events-none absolute inset-0 z-30 bg-black opacity-0"></div>
      </section>

      {/* Slide 8: BusinessOS Solution */}
      <section className="solution-slide relative flex min-h-screen items-center justify-center bg-black px-6">
        <div className="pointer-events-none absolute inset-0">
          {/* Center glow */}
          <div className="absolute left-1/2 top-1/2 size-[700px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary-500/30 blur-[250px]" />
        </div>
        <div className="relative z-10 max-w-4xl text-center">
          {/* Typewriter title */}
          <h2 className="slide-title text-3xl font-bold text-white md:text-4xl lg:text-5xl">
            <span className="typewriter-title inline">
              {"BusinessOS".split("").map((char, i) => (
                <span key={i} className="typewriter-char inline-block opacity-0">{char}</span>
              ))}
              <span className="typewriter-char inline-block text-sm text-primary-300 opacity-0 md:text-base">©</span>
              <span className="typewriter-char inline-block opacity-0">&nbsp;</span>
              {"is how you fix it".split("").map((char, i) => (
                <span key={`fix-${i}`} className="typewriter-char inline-block opacity-0">{char === " " ? "\u00A0" : char}</span>
              ))}
            </span>
          </h2>
          {/* Typewriter subtitle */}
          <p className="slide-subtitle mt-2 text-2xl font-bold text-primary-200 md:text-3xl">
            <span className="typewriter-subtitle inline">
              {"for good.".split("").map((char, i) => (
                <span key={i} className="typewriter-char-sub inline-block opacity-0">{char === " " ? "\u00A0" : char}</span>
              ))}
            </span>
          </p>
          <p className="slide-description mt-6 text-xl text-white/90 opacity-0 md:text-2xl">
            One platform. Custom-built.<br />
            Like a tailored suit for your business.
          </p>
        </div>
      </section>

      {/* Slide 9: How It Works */}
      <section className="how-it-works-slide relative flex min-h-screen items-center justify-center bg-black px-6 py-20">
        <div className="pointer-events-none absolute inset-0">
          {/* Center ambient glows */}
          <div className="absolute left-1/4 top-1/3 size-80 rounded-full bg-primary-400/10 blur-[150px]" />
          <div className="absolute bottom-1/3 right-1/4 size-80 rounded-full bg-primary-600/10 blur-[150px]" />
        </div>
        <div className="relative z-10 w-full max-w-6xl">
          <h2 className="slide-title mb-16 text-center text-3xl font-bold text-white md:text-4xl lg:text-5xl">
            How It Works
          </h2>
          
          {/* Phases Grid */}
          <div className="how-it-works-grid grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* Phase 1: Connect & Unify Your Data */}
            <div className="step-card group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 backdrop-blur-sm transition-all duration-500 hover:border-primary-500/50 hover:bg-neutral-900/80">
              <div className="step-icon mb-4 flex size-14 items-center justify-center rounded-xl bg-primary-500/20 text-primary-400 transition-all duration-500 group-hover:scale-110 group-hover:bg-primary-500/30">
                {/* Database/Connect Icon */}
                <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                </svg>
              </div>
              <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-400">Phase 1</span>
              <h3 className="mb-2 text-lg font-bold text-white">We Connect & Unify Your Data</h3>
              <p className="mb-3 text-sm text-neutral-400">Centralize everything into a single source of truth.</p>
              <p className="text-xs italic text-neutral-500">&ldquo;For the first time, everything&apos;s in one place. I finally trust the data.&rdquo;</p>
            </div>

            {/* Phase 2: Automate Your Reporting */}
            <div className="step-card group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 backdrop-blur-sm transition-all duration-500 hover:border-primary-500/50 hover:bg-neutral-900/80">
              <div className="step-icon mb-4 flex size-14 items-center justify-center rounded-xl bg-primary-500/20 text-primary-400 transition-all duration-500 group-hover:scale-110 group-hover:bg-primary-500/30">
                {/* Chart/Dashboard Icon */}
                <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-400">Phase 2</span>
              <h3 className="mb-2 text-lg font-bold text-white">We Automate Your Reporting</h3>
              <p className="mb-3 text-sm text-neutral-400">Turn raw data into real-time insights with live dashboards.</p>
              <p className="text-xs italic text-neutral-500">&ldquo;I no longer wait for reports. I know what&apos;s happening, right now.&rdquo;</p>
            </div>

            {/* Phase 3: Standardize Your Manual Processes */}
            <div className="step-card group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 backdrop-blur-sm transition-all duration-500 hover:border-primary-500/50 hover:bg-neutral-900/80">
              <div className="step-icon mb-4 flex size-14 items-center justify-center rounded-xl bg-primary-500/20 text-primary-400 transition-all duration-500 group-hover:scale-110 group-hover:bg-primary-500/30">
                {/* Document/SOP Icon */}
                <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-400">Phase 3</span>
              <h3 className="mb-2 text-lg font-bold text-white">We Standardize Manual Processes</h3>
              <p className="mb-3 text-sm text-neutral-400">Fix what&apos;s undocumented,inconsistent, or in employee&apos;s heads.</p>
              <p className="text-xs italic text-neutral-500">&ldquo;Everyone finally does it the same way. There&apos;s clarity, not chaos.&rdquo;</p>
            </div>

            {/* Phase 4: Automate Repeatable Work */}
            <div className="step-card group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 backdrop-blur-sm transition-all duration-500 hover:border-primary-500/50 hover:bg-neutral-900/80">
              <div className="step-icon mb-4 flex size-14 items-center justify-center rounded-xl bg-primary-500/20 text-primary-400 transition-all duration-500 group-hover:scale-110 group-hover:bg-primary-500/30">
                {/* Automation/Sync Icon */}
                <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-400">Phase 4</span>
              <h3 className="mb-2 text-lg font-bold text-white">We Automate Repeatable Work</h3>
              <p className="mb-3 text-sm text-neutral-400">Remove human steps from standardized processes.</p>
              <p className="text-xs italic text-neutral-500">&ldquo;Things just happen now. No chasing. No reminding.&rdquo;</p>
            </div>

            {/* Phase 5: Layer in AI */}
            <div className="step-card group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 backdrop-blur-sm transition-all duration-500 hover:border-primary-500/50 hover:bg-neutral-900/80">
              <div className="step-icon mb-4 flex size-14 items-center justify-center rounded-xl bg-primary-500/20 text-primary-400 transition-all duration-500 group-hover:scale-110 group-hover:bg-primary-500/30">
                {/* AI/Sparkle Icon */}
                <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-400">Phase 5</span>
              <h3 className="mb-2 text-lg font-bold text-white">We Layer in AI</h3>
              <p className="mb-3 text-sm text-neutral-400">Upgrade automation with AI agents that learn and adapt.</p>
              <p className="text-xs italic text-neutral-500">&ldquo;It&apos;s like having another team working 24/7, without adding headcount.&rdquo;</p>
            </div>

            {/* Phase 6: Optimize, Scale & Self-Improve */}
            <div className="step-card group relative overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6 backdrop-blur-sm transition-all duration-500 hover:border-primary-500/50 hover:bg-neutral-900/80">
              <div className="step-icon mb-4 flex size-14 items-center justify-center rounded-xl bg-primary-500/20 text-primary-400 transition-all duration-500 group-hover:scale-110 group-hover:bg-primary-500/30">
                {/* Infinity/Loop Icon */}
                <svg className="size-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 4v5h.582m0 0a8.001 8.001 0 0115.356 2M4.582 9H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-primary-400">Phase 6</span>
              <h3 className="mb-2 text-lg font-bold text-white">We Optimize, Scale & Self-Improve</h3>
              <p className="mb-3 text-sm text-neutral-400">Build a system that improves itself over time.</p>
              <p className="text-xs italic text-neutral-500">&ldquo;The system runs, and gets smarter, without me.&rdquo;</p>
            </div>
          </div>
        </div>
      </section>

      {/* ROI Calculator */}
      <ROICalculator />

      {/* Footer */}
      {/* <footer className="border-t border-neutral-800 px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <Image
              src="/logo.png"
              alt="Jaro.dev"
              width={24}
              height={24}
              className="rounded"
            />
            <span className="text-neutral-400">
              BusinessOS© by{" "}
              <Link href="https://jaro.dev" className="text-white hover:text-primary-400">
                Jaro.dev
              </Link>
            </span>
          </div>
          <p className="text-sm text-neutral-500">
            © {new Date().getFullYear()} Jaro.dev. All rights reserved.
          </p>
        </div>
      </footer> */}

      {/* Video Modal */}
      <Dialog open={isVideoModalOpen} onOpenChange={setIsVideoModalOpen}>
        <DialogContent 
          className="flex w-[70vw] max-w-4xl items-center justify-center border-none bg-transparent p-0 shadow-none"
          hideCloseButton
          onEscapeKeyDown={() => setIsVideoModalOpen(false)}
          onPointerDownOutside={() => setIsVideoModalOpen(false)}
          onInteractOutside={() => setIsVideoModalOpen(false)}
        >
          <VisuallyHidden>
            <DialogTitle>BusinessOS Demo Video</DialogTitle>
          </VisuallyHidden>
          <div className="relative aspect-video w-full">
            <iframe
              src={`https://fast.wistia.net/embed/iframe/iy3kq6lumi?autoplay=${isMobile ? 0 : 1}`}
              title="BusinessOS Demo"
              allow="autoplay; fullscreen"
              allowFullScreen
              className="absolute inset-0 size-full rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
