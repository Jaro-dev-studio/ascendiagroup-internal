"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import dayjs from "dayjs";
import { CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "./button";

interface DatePickerProps {
  date?: Date;
  onChange?: (date?: Date) => void;
  disabled?: boolean;
  placeholder?: string;
  required?: boolean;
  name?: string;
  defaultValue?: Date;
}

export function DatePicker({
  date,
  onChange,
  disabled,
  placeholder = "Select date",
  required = false,
  name,
  defaultValue,
}: DatePickerProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(defaultValue);
  const [currentMonth, setCurrentMonth] = useState(dayjs());
  const [showMonthPicker, setShowMonthPicker] = useState(false);
  const [showYearPicker, setShowYearPicker] = useState(false);

  useEffect(() => {
    setSelectedDate(date);
  }, [date]);

  const daysInMonth = Array.from(
    { length: currentMonth.daysInMonth() },
    (_, i) => currentMonth.startOf("month").add(i, "day")
  );

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  const years = Array.from({ length: 20 }, (_, i) => 
    dayjs().subtract(10, "year").add(i, "year").year()
  );

  const handleDateSelect = (date: dayjs.Dayjs) => {
    setCurrentMonth(date);
    setSelectedDate(date.toDate());
    onChange?.(date.toDate());
  };

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Input
          name={name}
          icon={<CalendarIcon className="size-4" />}
          required={required}
          disabled={disabled}
          readOnly
          value={selectedDate ? dayjs(selectedDate).format("MMMM D, YYYY") : placeholder}
          placeholder={placeholder}
          className={cn(
            "cursor-pointer text-start",
            !selectedDate && "text-text-secondary"
          )}
        />
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="space-y-4 p-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(prev => prev.subtract(1, "month"))}
            >
              <ChevronLeft className="size-4" />
            </Button>
            <div className="flex gap-1 font-semibold">
              <Button
                variant="ghost"
                onClick={() => {
                  setShowMonthPicker(!showMonthPicker);
                  setShowYearPicker(false);
                }}
              >
                {currentMonth.format("MMMM")}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowYearPicker(!showYearPicker);
                  setShowMonthPicker(false);
                }}
              >
                {currentMonth.format("YYYY")}
              </Button>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(prev => prev.add(1, "month"))}
            >
              <ChevronRight className="size-4" />
            </Button>
          </div>

          <AnimatePresence mode="wait">
            {showMonthPicker ? (
              <motion.div
                key="month-picker"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-3 gap-2"
              >
                {months.map((month, i) => (
                  <Button
                    key={month}
                    variant={currentMonth.month() === i ? "default" : "ghost"}
                    onClick={() => {
                      setCurrentMonth(currentMonth.month(i));
                      setShowMonthPicker(false);
                    }}
                    className="h-9"
                  >
                    {month.slice(0, 3)}
                  </Button>
                ))}
              </motion.div>
            ) : showYearPicker ? (
              <motion.div
                key="year-picker"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="grid grid-cols-4 gap-2"
              >
                {years.map(year => (
                  <Button
                    key={year}
                    variant={currentMonth.year() === year ? "default" : "ghost"}
                    onClick={() => {
                      setCurrentMonth(currentMonth.year(year));
                      setShowYearPicker(false);
                    }}
                    className="h-9"
                  >
                    {year}
                  </Button>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="calendar"
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
              >
                <div className="mb-2 grid grid-cols-7 text-center text-sm">
                  {["S", "M", "T", "W", "T", "F", "S"].map(day => (
                    <div key={day} className="text-text-secondary">
                      {day}
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-7 gap-1">
                  {daysInMonth.map(date => (
                    <Button
                      key={date.toString()}
                      variant={dayjs(selectedDate).isSame(date, "day") ? "default" : "ghost"}
                      className={cn(
                        "h-9 w-9 p-0 font-normal",
                        date.isSame(dayjs(), "day") && "border border-primary"
                      )}
                      onClick={() => handleDateSelect(date)}
                    >
                      {date.date()}
                    </Button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </PopoverContent>
    </Popover>
  );
} 