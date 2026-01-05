#!/usr/bin/env python3

# Read the file
with open('components/project-tabs/quiz-tab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix main container - ensure it doesn't overflow
content = content.replace(
    '  return (\n    <div className="space-y-6 w-full max-w-full overflow-x-hidden box-border">',
    '  return (\n    <div className="space-y-6 w-full max-w-full overflow-x-hidden box-border" style={{ width: "100%", maxWidth: "100%" }}>'
)

# Fix progress bar - ensure calculation is correct and doesn't overflow
# The progress should be: (currentQuestionIndex + 1) / totalQuestions * 100
# At the last question (index = totalQuestions - 1), it should be 100%
old_progress_calc = 'width: `${Math.min(((currentQuestionIndex + 1) / totalQuestions) * 100, 100)}%`'
new_progress_calc = 'width: `${Math.min(((currentQuestionIndex + 1) / totalQuestions) * 100, 100)}%`'
# Actually, the calculation is correct. The issue might be that it's showing 100% when it shouldn't.
# Let me check - if currentQuestionIndex is 22 (23rd question) and totalQuestions is 48, 
# then (22 + 1) / 48 * 100 = 47.9%, which is correct.
# But the user says it shows 100% at the last visible question. This suggests the container width is wrong.

# Fix progress bar container to ensure it respects parent width
content = content.replace(
    '        <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3 overflow-hidden">',
    '        <div className="w-full bg-gray-200 rounded-full h-2 sm:h-3 overflow-hidden" style={{ width: "100%", maxWidth: "100%" }}>'
)

# Fix progress bar inner div
content = content.replace(
    '            className="bg-emerald-600 h-2 sm:h-3 rounded-full transition-all duration-300 max-w-full"',
    '            className="bg-emerald-600 h-2 sm:h-3 rounded-full transition-all duration-300" style={{ maxWidth: "100%" }}'
)

# Fix all glass-card containers to ensure they don't overflow
content = content.replace(
    '      <div className="glass-card rounded-2xl p-4 sm:p-6 w-full max-w-full overflow-hidden">',
    '      <div className="glass-card rounded-2xl p-4 sm:p-6 w-full max-w-full overflow-hidden box-border" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>'
)

content = content.replace(
    '      <div className="glass-card rounded-2xl p-4 sm:p-6 md:p-8 w-full max-w-full overflow-hidden">',
    '      <div className="glass-card rounded-2xl p-4 sm:p-6 md:p-8 w-full max-w-full overflow-hidden box-border" style={{ width: "100%", maxWidth: "100%", boxSizing: "border-box" }}>'
)

# Fix navigation container
content = content.replace(
    '      <div className="space-y-4 w-full max-w-full overflow-x-hidden">',
    '      <div className="space-y-4 w-full max-w-full overflow-x-hidden box-border" style={{ width: "100%", maxWidth: "100%" }}>'
)

# Fix the question navigation container - ensure buttons don't cause overflow
content = content.replace(
    '        <div className="flex items-center gap-2 w-full min-w-0">',
    '        <div className="flex items-center gap-2 w-full min-w-0 box-border" style={{ width: "100%", maxWidth: "100%" }}>'
)

# Fix scroll container - ensure it can shrink
content = content.replace(
    '            className="flex-1 min-w-0 overflow-x-auto px-2 scrollbar-hide"',
    '            className="flex-1 min-w-0 overflow-x-auto px-2 scrollbar-hide box-border" style={{ minWidth: 0, maxWidth: "100%" }}>'
)

# Fix Previous/Next buttons container
content = content.replace(
    '        <div className="flex items-center justify-between gap-4 w-full min-w-0">',
    '        <div className="flex items-center justify-between gap-4 w-full min-w-0 box-border" style={{ width: "100%", maxWidth: "100%" }}>'
)

# Write the file
with open('components/project-tabs/quiz-tab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("File updated successfully!")

