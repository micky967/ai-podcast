#!/usr/bin/env python3
with open('components/project-tabs/quiz-tab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Reduce progress bar text sizes
content = content.replace('text-sm sm:text-base font-medium', 'text-xs font-medium')
content = content.replace('text-xs sm:text-sm', 'text-xs')

# Reduce question number button sizes
content = content.replace('w-8 h-8 sm:w-10 sm:h-10', 'w-6 h-6')
content = content.replace('text-xs sm:text-sm', 'text-xs')

# Reduce icon sizes
content = content.replace('h-4 w-4', 'h-3 w-3')

# Reduce progress bar height
content = content.replace('h-2 sm:h-3', 'h-1.5')

with open('components/project-tabs/quiz-tab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

# Also reduce padding
with open('components/project-tabs/quiz-tab.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

content = content.replace('p-4 sm:p-6', 'p-2 sm:p-3')
content = content.replace('p-4 sm:p-6 md:p-8', 'p-2 sm:p-3')

with open('components/project-tabs/quiz-tab.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

print("Reduced all sizes!")

