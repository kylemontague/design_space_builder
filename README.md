# Radar Chart Design Space Builder

A versatile, client-side tool for creating and visualizing design spaces using interactive radar charts.

## Overview

The **Radar Chart Design Space Builder** is a single-page application (SPA) designed to help researchers, designers, and data analysts create visual representations of multi-dimensional design spaces. It allows users to define custom dimensions, create data points (profiles/configurations), and visualize them on an interactive radar chart.

## Features

-   **Custom Dimensions:** Add, remove, and reorder dimensions. Define levels (Low, Medium, High, etc.) for each dimension with descriptions.
-   **Interactive Data Points:** Create multiple data points representing different configurations or profiles. Drag and drop handles on the chart to adjust values intuitively.
-   **Visual Customization:** Choose from various color schemes (Default, Colorblind-friendly, Monochrome, Warm, Cool) and adjust chart dimensions.
-   **Export & Import:**
    -   **Export Config (JSON):** Save your entire workspace state to a JSON file.
    -   **Import Config:** Restore a previously saved workspace.
    -   **Export SVG:** Download high-quality SVG images of your chart for use in papers or presentations.
-   **Documentation Support:** Automatically generate HTML or LaTeX tables for your dimension definitions.
-   **Accessibility:** Includes ARIA attributes for screen readers and keyboard navigation support.
-   **Undo/Redo:** Easily revert changes with a built-in history system.

## Usage Guide

1.  **Dimensions Tab:**
    -   Click **+ Add** to create a new dimension.
    -   Click the **Pencil** icon to edit the dimension name, description, and levels.
    -   Use **Up/Down** arrows to reorder dimensions on the axes.

2.  **Data Tab:**
    -   Click **+ Add** to create a new data point (e.g., "System A").
    -   Click the **Eye** icon to toggle visibility on the chart.
    -   Click the **Pencil** icon to rename or manually set values via dropdowns.

3.  **Interactive Chart:**
    -   **Drag:** Click and drag the circular handles on the chart to change the value of a data point for a specific dimension.
    -   **Keyboard:** Focus on a handle (Tab) and use **Arrow Keys** to adjust values.

4.  **Theme Tab:**
    -   Adjust the chart width and height.
    -   Select a color scheme that fits your publication or presentation needs.

5.  **Docs Tab:**
    -   View tables summarizing your dimensions and levels.
    -   Click **Word** (HTML) or **LaTeX** to copy the table code to your clipboard.

6.  **Export Tab:**
    -   **Export Config:** Save your work.
    -   **Export as SVG:** Get the image.

## Development

This project uses standard web technologies (HTML, CSS, JavaScript) and requires no build step.

### Prerequisites
-   A modern web browser (Chrome, Firefox, Safari, Edge).

### Getting Started
1.  Clone the repository or download the files.
2.  Open `index.html` in your web browser.
3.  That's it!

### File Structure
-   `index.html`: Main entry point and layout.
-   `css/style.css`: Styling and layout rules.
-   `js/script.js`: Application logic, state management, and rendering.

## Compatibility
The application is designed for modern "evergreen" browsers and utilizes ES6+ features. It stores data locally in your browser's `localStorage` so you don't lose your work on refresh.
