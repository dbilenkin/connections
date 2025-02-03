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
  function shuffleArray(array) {
    // Make a shallow copy of the array to avoid mutating the original
    const newArray = array.slice();
    for (let i = newArray.length - 1; i > 0; i--) {
      // Pick a random index from 0 to i (inclusive)
      const j = Math.floor(Math.random() * (i + 1));
      // Swap newArray[i] with newArray[j]
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }


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
  const [shake, setShake] = useState(false);
  const [puzzle, setPuzzle] = useState([]);

  // Example: Use this useEffect to fetch the puzzle from your Google Sheet.
  useEffect(() => {
    const fetchPuzzle = async () => {
      // Replace these values with your actual spreadsheet ID, range, and API key.
      const spreadsheetId = '1FQQ7Fq33o0Id1mVxqYPLWDeESw9PHtny_TUmVhAsVuE';
      const range = 'Sheet1'; // Change if your sheet or named range is different.
      const apiKey = 'AIzaSyB63KBJD9T40Cx-bH0WONPsRJ5_1IzVaJs';
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;

      try {
        const response = await fetch(url);
        const data = await response.json();
        const rows = data.values;
        if (rows && rows.length > 1) {
          // Assume the first row contains headers.
          // e.g. ["Difficulty", "Category", "Clue 1", "Clue 2", "Clue 3", "Clue 4"]
          const puzzleData = rows.slice(1).map((row) => {
            return {
              [row[1]]: [row[2], row[3], row[4], row[5]]
            };
          });
          setPuzzle(puzzleData);
        }
      } catch (error) {
        console.error("Error fetching puzzle data:", error);
      }
    };

    fetchPuzzle();
  }, []);

  // For demonstration purposes, you can log the puzzle once it's loaded.
  useEffect(() => {
    if (puzzle.length) {
      console.log("Puzzle data:", puzzle);
    }
  }, [puzzle]);

  // On mount, initialize grid and lookup from puzzle.
  useEffect(() => {
    const words = [];
    const lookup = {};

    puzzle.forEach((categoryObj, difficulty) => {
      const category = Object.keys(categoryObj)[0]; // e.g. "letters"
      categoryObj[category].forEach((word) => {
        words.push(word);
        lookup[word] = { category, difficulty };
      });
    });

    setGrid(shuffleArray(words));
    setWordLookup(lookup);
  }, [puzzle]);

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
    const shuffledArray = [...unshuffledWords, ...shuffleArray(shuffledWords)]

    setGrid(shuffledArray);
  };

  // Deselect All clears the current selection.
  const handleDeselectAll = () => {
    setSelectedItems([]);
  };

  // Called when mistakes run out.
  const solvePuzzle = () => {
    // Build the solved grid generically:
    const solvedGrid = puzzle.reduce((acc, obj) => {
      // Get the first (and only) array in each object
      const row = Object.values(obj)[0];
      return acc.concat(row);
    }, []);
    setGrid(solvedGrid);
    // Assuming each object represents a row, set solved rows count to the number of objects
    setSolvedRowsCount(puzzle.length);
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
      setSelectedItems([]);
    } else {
      // Wrong guess: trigger shake animation on selected cells.
      setShake(true);
      // After the shake duration, clear selection and update mistakes.
      setTimeout(() => {
        setShake(false);
        const newMistakes = mistakesRemaining - 1;
        setMistakesRemaining(newMistakes);
        if (newMistakes === 0) {
          alert("Sorry you weren't able to solve the puzzle");
          solvePuzzle();
        }
      }, 500); // Duration matches the CSS animation duration.
    }
  };

  // Dynamically compute a font size based on the longest word in the string.
  const getFontSize = (word) => {
    if (!word) return "1rem";
    const longestWord = word.split(" ").reduce(
      (longest, current) => (current.length > longest.length ? current : longest),
      ""
    );
    return `${Math.min(1.1, 6 / longestWord.length)}rem`;
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
          const isSelected = selectedItems.includes(word);
          const cellClass = `grid-item ${isSelected ? "selected" : ""} ${isSelected && shake ? "shake" : ""}`;
          elements.push(
            <div
              key={rowStart + col}
              className={cellClass}
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
