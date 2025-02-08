import { useState, useEffect } from "react";
import "./App.css";

function App() {
  const difficultyColors = ["#f0d66a", "#9bbd57", "#aabee7", "#b37cc0"];

  // Helper: proper Fisher–Yates shuffle
  function shuffleArray(array) {
    const newArray = array.slice();
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  }

  // Google Sheets info
  const spreadsheetId = '1FQQ7Fq33o0Id1mVxqYPLWDeESw9PHtny_TUmVhAsVuE';
  const apiKey = 'AIzaSyB63KBJD9T40Cx-bH0WONPsRJ5_1IzVaJs';

  // Puzzler & Puzzle Data
  const [puzzleList, setPuzzleList] = useState([]);         // List of sheet names (each a puzzler)
  const [currentSheet, setCurrentSheet] = useState("");       // Currently selected sheet name (puzzler)
  const [puzzles, setPuzzles] = useState([]);                 // Array of puzzles from the selected sheet
  const [currentPuzzleIndex, setCurrentPuzzleIndex] = useState(0); // Index of the selected puzzle

  // Game state
  const [grid, setGrid] = useState([]);
  const [wordLookup, setWordLookup] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);
  const [solvedRowsCount, setSolvedRowsCount] = useState(0);
  const [mistakesRemaining, setMistakesRemaining] = useState(4);
  const [guessedCombinations, setGuessedCombinations] = useState([]);
  const [shake, setShake] = useState(false);

  /* -------------------------------------
     0. Fetch Puzzlers for the Dropdown
  -------------------------------------- */
  useEffect(() => {
    const fetchSheetNames = async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.sheets) {
          // Optionally skip the first sheet if it contains metadata:
          const names = data.sheets.slice(1).map(sheet => sheet.properties.title);
          setPuzzleList(names);
          // Read the query parameter and default to the first sheet if needed.
          const params = new URLSearchParams(window.location.search);
          const puzzlerParam = params.get("puzzler");
          const sheetToSet = (puzzlerParam && names.includes(puzzlerParam)) ? puzzlerParam : names[0];
          setCurrentSheet(sheetToSet);
        }
      } catch (error) {
        console.error("Error fetching sheet names:", error);
      }
    };
    fetchSheetNames();
  }, [spreadsheetId, apiKey]);

  /* -------------------------------------
    1. Fetch Puzzles for the Dropdown
  -------------------------------------- */
  useEffect(() => {
    if (!currentSheet) return;
    const fetchPuzzle = async () => {
      const range = currentSheet; // use the sheet name as the range
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        const rows = data.values;
        if (rows && rows.length > 1) {
          // Assume the first row is headers:
          // e.g.: ["Name (Optional)", "Category", "Clue 1", "Clue 2", "Clue 3", "Clue 4"]
          const dataRows = rows.slice(1);
          const puzzlesFromSheet = [];
          // Every 4 rows is one puzzle.
          for (let i = 0; i < dataRows.length; i += 4) {
            const group = dataRows.slice(i, i + 4);
            if (group.length < 4) break; // Skip incomplete groups.
            // Optional puzzle name from the first cell of the first row.
            const puzzleName = group[0][0] || "";
            const rowsData = group.map(row => ({
              category: row[1], // Category is in the 2nd column.
              clues: [row[2], row[3], row[4], row[5]] // Clues are in columns 3-6.
            }));
            puzzlesFromSheet.push({
              name: puzzleName,
              rows: rowsData
            });
          }
          setPuzzles(puzzlesFromSheet);
          // Reset the current puzzle selection.
          // Read the query parameter and default to the first sheet if needed.
          const params = new URLSearchParams(window.location.search);
          const puzzleParam = params.get("puzzle");
          const puzzleIndex = puzzleParam !== null ? puzzleParam : 0;
          setCurrentPuzzleIndex(puzzleIndex);
        }
      } catch (error) {
        console.error("Error fetching puzzle data:", error);
      }
    };
    fetchPuzzle();
  }, [currentSheet, spreadsheetId, apiKey]);


  /* -------------------------------------
     3. Initialize the Game Grid & Word Lookup when Puzzle Data Changes
  -------------------------------------- */
  useEffect(() => {
    if (puzzles && puzzles.length > 0) {
      // Use the currently selected puzzle.
      const activePuzzle = puzzles[currentPuzzleIndex];
      const words = [];
      const lookup = {};
      activePuzzle.rows.forEach((row, difficulty) => {
        row.clues.forEach(word => {
          words.push(word);
          lookup[word] = { category: row.category, difficulty };
        });
      });
      setGrid(shuffleArray(words));
      setWordLookup(lookup);
      // Reset game state.
      setSolvedRowsCount(0);
      setMistakesRemaining(4);
      setSelectedItems([]);
    }
  }, [puzzles, currentPuzzleIndex]);


  /* -------------------------------------
     4. Game Functions
  -------------------------------------- */
  // Only allow selection on unsolved cells.
  const handleSelect = (word) => {
    const index = grid.indexOf(word);
    const row = Math.floor(index / 4);
    if (row < solvedRowsCount) return; // ignore solved row
    if (selectedItems.includes(word)) {
      setSelectedItems(selectedItems.filter(item => item !== word));
    } else if (selectedItems.length < 4) {
      setSelectedItems([...selectedItems, word]);
    }
  };

  // Shuffle: only shuffles unsolved portion.
  const handleShuffle = () => {
    const startShuffle = solvedRowsCount * 4;
    const unshuffled = grid.slice(0, startShuffle);
    const shuffledPart = shuffleArray(grid.slice(startShuffle));
    setGrid([...unshuffled, ...shuffledPart]);
  };

  // Deselect All
  const handleDeselectAll = () => {
    setSelectedItems([]);
  };

  // Generic solvePuzzle: builds solved grid in order from the puzzle data.
  const solvePuzzle = () => {
    const puzzle = puzzles[currentPuzzleIndex];
    const solvedGrid = puzzle.rows.reduce((acc, obj) => {
      const row = obj.clues; // clues array
      return acc.concat(row);
    }, []);
    setGrid(solvedGrid);
    setSolvedRowsCount(puzzle.rows.length);
  };

  const handleMistake = () => {
    // Count the categories in the selected items.
    const categoryCounts = selectedItems.reduce((acc, word) => {
      const category = wordLookup[word].category;
      acc[category] = (acc[category] || 0) + 1;
      return acc;
    }, {});
    setShake(true);
    setTimeout(() => {
      setShake(false);
      const newMistakes = mistakesRemaining - 1;
      setMistakesRemaining(newMistakes);
      if (newMistakes === 0) {
        alert("Sorry you weren't able to solve the puzzle");
        solvePuzzle();
      } else if (Object.values(categoryCounts).some(count => count === 3)) {
        alert("One away");
      }
    }, 500)
  }

  // Handle Submit: if 4 selected words all belong to the same category, swap them into the next unsolved row.
  const handleSubmit = () => {
    if (selectedItems.length !== 4) return;

    // Determine the grid indices for the selected items.
    const guessIndices = selectedItems.map(word => grid.indexOf(word));
    // Sort the indices to ensure the guess order is consistent regardless of selection order.
    guessIndices.sort((a, b) => a - b);
    // Create a unique key (string) for this guess.
    const guessKey = guessIndices.join(',');

    // Check if this guess has already been attempted.
    if (guessedCombinations.includes(guessKey)) {
      alert("already guessed");
      return;
    }

    // Record this new guess.
    setGuessedCombinations([...guessedCombinations, guessKey]);

    const firstCategory = wordLookup[selectedItems[0]].category;
    const allMatch = selectedItems.every(word => wordLookup[word].category === firstCategory);

    if (allMatch) {
      // Correct selection: update the grid and solved rows.
      const newGrid = [...grid];
      const rowStart = solvedRowsCount * 4;
      selectedItems.forEach(selectedWord => {
        const selectedIndex = newGrid.indexOf(selectedWord);
        if (selectedIndex < rowStart || selectedIndex >= rowStart + 4) {
          const targetIndex = newGrid.findIndex((word, idx) =>
            idx >= rowStart && idx < rowStart + 4 && !selectedItems.includes(word)
          );
          if (targetIndex !== -1) {
            [newGrid[selectedIndex], newGrid[targetIndex]] = [newGrid[targetIndex], newGrid[selectedIndex]];
          }
        }
      });
      setGrid(newGrid);
      setSolvedRowsCount(solvedRowsCount + 1);
      if (solvedRowsCount + 1 === 4) {
        setTimeout(() => alert("You solved the puzzle!"), 100);
      }
      setSelectedItems([]);
    } else {
      handleMistake();
    }
  };


  // Calculate font size based on longest word.
  const getFontSize = (word) => {
    if (!word) return "1rem";
    const longestWord = word.split(" ").reduce((longest, current) =>
      current.length > longest.length ? current : longest, ""
    );
    return `${Math.min(1.1, 6 / longestWord.length)}rem`;
  };

  // Helper function to update URL query parameters.
  const updateQueryParams = (newParams) => {
    const params = new URLSearchParams(window.location.search);
    Object.entries(newParams).forEach(([key, value]) => {
      params.set(key, value);
    });
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
  };

  // Handle puzzler (sheet) change.
  const handlePuzzlerChange = (e) => {
    const puzzler = e.target.value;
    setCurrentSheet(puzzler);
    // Reset the puzzle index to 0 when the puzzler changes.
    setCurrentPuzzleIndex(0);
    updateQueryParams({ puzzler, puzzle: 0 });
  };

  // Handle puzzle selection change.
  const handlePuzzleSelectChange = (e) => {
    const puzzleIndex = parseInt(e.target.value, 10);
    setCurrentPuzzleIndex(puzzleIndex);
    updateQueryParams({ puzzle: puzzleIndex });
  };


  // Render the grid row-by-row.
  const renderGrid = () => {
    const elements = [];
    for (let row = 0; row < 4; row++) {
      const rowStart = row * 4;
      if (row < solvedRowsCount) {
        const rowWords = grid.slice(rowStart, rowStart + 4);
        const { category, difficulty } = wordLookup[rowWords[0]];
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

  // Render mistakes remaining.
  const renderMistakes = () => {
    const circles = [];
    for (let i = 0; i < mistakesRemaining; i++) {
      circles.push(<span key={i} className="mistake-circle">&#9679;</span>);
    }
    return (
      <div className="mistakes-container">
        <span className="mistakes-text">Mistakes Remaining: </span>
        {circles}
      </div>
    );
  };

  const renderHeader = () => {
    return (
      <div className="header">
        <span>
          <label htmlFor="puzzler-select">Puzzler: </label>
          <select id="puzzler-select" value={currentSheet} onChange={handlePuzzlerChange}>
            {puzzleList.map((sheet, index) => (
              <option key={index} value={sheet}>
                {sheet}
              </option>
            ))}
          </select>
        </span>
        <span>
          <label htmlFor="puzzle-select">Puzzle: </label>
          <select id="puzzle-select" value={currentPuzzleIndex} onChange={handlePuzzleSelectChange}>
            {puzzles.map((puzzle, index) => (
              <option key={index} value={index}>
                {puzzle.name || `Puzzle ${index + 1}`}
              </option>
            ))}
          </select>
        </span>
      </div>
    )
  }

  return (
    <div className="app-container">
      {renderHeader()}
      <div className="hr"></div>
      <span className="title">Create four groups of four!</span>
      <div className="grid-container">{renderGrid()}</div>
      {solvedRowsCount < 4 && renderMistakes()}
      <div className="button-container">
        <button className="button outline enabled" onClick={handleShuffle}>Shuffle</button>
        <button className={`button ${selectedItems.length > 0 ? "enabled" : ""}`} onClick={handleDeselectAll} disabled={selectedItems.length === 0}>
          Deselect All
        </button>
        <button className={`button submit ${selectedItems.length === 4 ? "enabled" : ""}`} onClick={handleSubmit} disabled={selectedItems.length !== 4}>
          Submit
        </button>
      </div>
    </div>
  );
}

export default App;
