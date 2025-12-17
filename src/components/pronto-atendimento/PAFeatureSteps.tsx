"use client"

import React, { useState, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "motion/react"
import { cn } from "@/lib/utils"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"

interface Feature {
  step: string
  title?: string
  content: string
  image: string
}

interface PAFeatureStepsProps {
  features: Feature[]
  className?: string
  title?: string
  subtitle?: string
  badge?: string
  autoPlayInterval?: number
}

export function PAFeatureSteps({
  features,
  className,
  title = "How to get Started",
  subtitle,
  badge,
  autoPlayInterval = 5000,
}: PAFeatureStepsProps) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const isMobile = useIsMobile()

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev + 1) % features.length)
  }, [features.length])

  const goToPrev = useCallback(() => {
    setCurrentIndex((prev) => (prev - 1 + features.length) % features.length)
  }, [features.length])

  useEffect(() => {
    if (isMobile) return
    const interval = setInterval(goToNext, autoPlayInterval)
    return () => clearInterval(interval)
  }, [goToNext, autoPlayInterval, isMobile])

  return (
    <div className={cn("py-16 md:py-24", className)}>
      <div className="container mx-auto px-4">
        {/* Header */}
        {(title || subtitle || badge) && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-12 md:mb-16"
          >
            {badge && (
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-full text-sm font-medium mb-4">
                {badge}
              </div>
            )}
            {title && (
              <h2 className="text-3xl md:text-4xl lg:text-5xl font-heading font-bold text-foreground">
                {title}
              </h2>
            )}
          </motion.div>
        )}

        {/* Mobile: Stacked Cards */}
        {isMobile ? (
          <div className="flex flex-col gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="bg-card border border-border/30 rounded-2xl overflow-hidden p-6"
              >
                <div className="flex items-center gap-3 mb-4">
                  <span className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                    {index + 1}
                  </span>
                  <h3 className="text-xl font-heading font-bold text-foreground">
                    {feature.title || feature.step}
                  </h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed mb-4">
                  {feature.content}
                </p>
                <div className="flex justify-center">
                  <img
                    src={feature.image}
                    alt={feature.title || feature.step}
                    className="w-48 h-auto object-contain rounded-lg"
                  />
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          /* Desktop: Carousel */
          <div className="max-w-4xl mx-auto">
            {/* Slide Content */}
            <div className="relative">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentIndex}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.4 }}
                  className="bg-card border border-border/30 rounded-2xl overflow-hidden"
                >
                  <div className="p-8 lg:p-12 flex flex-col md:flex-row gap-8 items-center">
                    {/* Content - Left */}
                    <div className="flex-1 text-left">
                      <div className="flex items-center gap-4 mb-4">
                        <span className="w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-lg font-bold">
                          {currentIndex + 1}
                        </span>
                        <h3 className="text-2xl lg:text-3xl font-heading font-bold text-foreground">
                          {features[currentIndex].title || features[currentIndex].step}
                        </h3>
                      </div>
                      <p className="text-muted-foreground text-base lg:text-lg leading-relaxed max-w-md ml-14">
                        {features[currentIndex].content}
                      </p>
                    </div>

                    {/* Image - Right */}
                    <div className="flex-shrink-0">
                      <div className="w-[200px] lg:w-[280px] rounded-xl overflow-hidden">
                        <img
                          src={features[currentIndex].image}
                          alt={features[currentIndex].title || features[currentIndex].step}
                          className="w-full h-auto object-contain"
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              </AnimatePresence>

              {/* Navigation Arrows */}
              <button
                onClick={goToPrev}
                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 lg:-translate-x-16 w-12 h-12 rounded-full bg-card border border-border/50 flex items-center justify-center text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                onClick={goToNext}
                className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 lg:translate-x-16 w-12 h-12 rounded-full bg-card border border-border/50 flex items-center justify-center text-foreground hover:bg-primary hover:text-primary-foreground transition-colors"
              >
                <ChevronRight className="w-6 h-6" />
              </button>
            </div>

            {/* Progress Bar */}
            <div className="flex gap-2 justify-center mt-6">
              {features.map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    "h-1.5 rounded-full transition-all duration-300",
                    currentIndex === index ? "w-8 bg-primary" : "w-2 bg-muted"
                  )}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
