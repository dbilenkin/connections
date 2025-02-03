import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const testPuzzle = [
    { "Types of Snakes": ["Cobra", "Python", "Viper", "Mamba"] },
    { "Precious Stones": ["Ruby", "Diamond", "Emerald", "Sapphire"] },
    { "Slang for Coffee": ["Java", "Brew", "Joe", "Mud"] },
    { "70s American Muscle Cars": ["Charger", "Mustang", "Camaro", "GTO"] }
  ];

  const difficultyColors = ["#f0d66a", "#9bbd57", "#aabee7", "#b37cc0"];

  // Helper: shuffle an array
  const shuffleArray = (array) => [...array].sort(() => Math.random() - 0.5);

  // State:
  // grid: the current order of the 16 words
  // wordLookup: maps each word to its category
  // selectedItems: the currently selected words (up to 4)
  // solvedRowsCount: number of rows solved (from the top)
  // mistakesRemaining: number of mistakes left (starts at 4)
  const [grid, setGrid] = useState([]);
  const [wordLookup, setWordLookup] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);
  const [solvedRowsCount, setSolvedRowsCount] = useState(0);
  const [mistakesRemaining, setMistakesRemaining] = useState(4);

  // On mount, initialize grid and lookup from testPuzzle.
  useEffect(() => {
    const words = [];
    const lookup = {};

    testPuzzle.forEach((categoryObj, difficulty) => {
      const category = Object.keys(categoryObj)[0]; // e.g. "letters"
      categoryObj[category].forEach((word) => {
        words.push(word);
        lookup[word] = { category, difficulty };
      });
    });

    setGrid(shuffleArray(words));
    setWordLookup(lookup);
  }, []);

  // Allow selection only on unsolved cells.
  const handleSelect = (word) => {
    const index = grid.indexOf(word);
    const row = Math.floor(index / 4);
    if (row < solvedRowsCount) return; // already solved row, ignore

    if (selectedItems.includes(word)) {
      setSelectedItems(selectedItems.filter((item) => item !== word));
    } else if (selectedItems.length < 4) {
      setSelectedItems([...selectedItems, word]);
    }
  };

  // Shuffle resets grid, selection, solved rows, and mistakes.
  const handleShuffle = () => {
    const startShuffle = solvedRowsCount * 4;
    const unshuffledWords = grid.slice(0, startShuffle);
    const shuffledWords = grid.slice(startShuffle);
    shuffledWords.sort(() => Math.random() - 0.5);
    const shuffledArray = [...unshuffledWords, ...shuffledWords]

    setGrid(shuffledArray);

  };

  // Deselect All clears the current selection.
  const handleDeselectAll = () => {
    setSelectedItems([]);
  };

  // Called when mistakes run out.
  const solvePuzzle = () => {
    // Build the solved grid in the correct order:
    const solvedGrid = [
      ...testPuzzle[0].letters,
      ...testPuzzle[1].numbers,
      ...testPuzzle[2].actors,
      ...testPuzzle[3].stars,
    ];
    setGrid(solvedGrid);
    setSolvedRowsCount(4);
  };

  // Handle Submit:
  // If exactly 4 words are selected:
  //   - If they all belong to the same category, swap them into the next unsolved row.
  //   - Otherwise, decrement mistakesRemaining.
  // If mistakesRemaining hits 0, display a message and solve the puzzle.
  const handleSubmit = () => {
    if (selectedItems.length !== 4) return;

    const firstCategory = wordLookup[selectedItems[0]].category;
    const allMatch = selectedItems.every((word) => wordLookup[word].category === firstCategory);

    if (allMatch) {
      const newGrid = [...grid];
      const rowStart = solvedRowsCount * 4; // target row indices

      // For each selected word not already in the target row,
      // swap it with a cell in the target row that is not selected.
      selectedItems.forEach((selectedWord) => {
        const selectedIndex = newGrid.indexOf(selectedWord);
        if (selectedIndex < rowStart || selectedIndex >= rowStart + 4) {
          const targetIndex = newGrid.findIndex(
            (word, idx) =>
              idx >= rowStart &&
              idx < rowStart + 4 &&
              !selectedItems.includes(word)
          );
          if (targetIndex !== -1) {
            [newGrid[selectedIndex], newGrid[targetIndex]] = [newGrid[targetIndex], newGrid[selectedIndex]];
          }
        }
      });

      setGrid(newGrid);
      setSolvedRowsCount(solvedRowsCount + 1);
      // If puzzle solved, you might show a "solved" message.
      if (solvedRowsCount + 1 === 4) {
        setTimeout(() => alert("You solved the puzzle!"), 100);
      }
    } else {
      // Wrong submission: decrement mistakesRemaining.
      const newMistakes = mistakesRemaining - 1;
      setMistakesRemaining(newMistakes);
      if (newMistakes === 0) {
        alert("Sorry you weren't able to solve the puzzle");
        solvePuzzle();
      }
    }
    // Clear selection in either case.
    setSelectedItems([]);
  };

  // Dynamically compute a font size based on the longest word in the string.
  const getFontSize = (word) => {
    if (!word) return "1rem";
    const longestWord = word.split(" ").reduce(
      (longest, current) => (current.length > longest.length ? current : longest),
      ""
    );
    return `${Math.min(1.1, 8 / longestWord.length)}rem`;
  };

  // Render the grid row-by-row.
  // For rows that have been solved (row index < solvedRowsCount), merge them into one cell.
  // Otherwise, render individual cells.
  const renderGrid = () => {
    const elements = [];
    for (let row = 0; row < 4; row++) {
      const rowStart = row * 4;
      if (row < solvedRowsCount) {
        const rowWords = grid.slice(rowStart, rowStart + 4);
        const { category, difficulty } = wordLookup[rowWords[0]]; // all words in this solved row share the same category
        elements.push(
          <div key={`merged-${row}`} className="grid-item merged" style={{ gridColumn: "1 / -1", backgroundColor: difficultyColors[difficulty] }}>
            <div className="merged-category">{category}</div>
            <div className="merged-words">{rowWords.join(", ")}</div>
          </div>
        );
      } else {
        for (let col = 0; col < 4; col++) {
          const word = grid[rowStart + col];
          elements.push(
            <div
              key={rowStart + col}
              className={`grid-item ${selectedItems.includes(word) ? "selected" : ""}`}
              style={{ fontSize: getFontSize(word) }}
              onClick={() => handleSelect(word)}
            >
              {word}
            </div>
          );
        }
      }
    }
    return elements;
  };

  // Render the mistakes remaining section.
  // We'll display the text and as many filled circles as mistakes remain.
  const renderMistakes = () => {
    const circles = [];
    for (let i = 0; i < mistakesRemaining; i++) {
      circles.push(
        <span key={i} className="mistake-circle">
          &#9679;
        </span>
      );
    }
    return (
      <div className="mistakes-container">
        <span className="mistakes-text">Mistakes Remaining: </span>
        {circles}
      </div>
    );
  };

  return (
    <div className="app-container">
      <span className="title">Create four groups of four!</span>

      <div className="grid-container">
        {renderGrid()}
      </div>

      {solvedRowsCount < 4 && renderMistakes()}

      <div className="button-container">
        <button className="button outline enabled" onClick={handleShuffle}>Shuffle</button>
        <button
          className={`button ${selectedItems.length > 0 ? "enabled" : ""}`}
          onClick={handleDeselectAll}
          disabled={selectedItems.length === 0}
        >
          Deselect All
        </button>
        <button
          className={`button submit ${selectedItems.length === 4 ? "enabled" : ""}`}
          onClick={handleSubmit}
          disabled={selectedItems.length !== 4}
        >
          Submit
        </button>
      </div>
    </div>
  );
}

export default App;
