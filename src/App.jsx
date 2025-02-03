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

  // Puzzle-related state
  const [puzzleList, setPuzzleList] = useState([]); // list of sheet names (each a puzzle)
  const [currentSheet, setCurrentSheet] = useState(""); // currently selected sheet name
  const [puzzle, setPuzzle] = useState([]); // parsed puzzle data from the selected sheet

  // Game state
  const [grid, setGrid] = useState([]);
  const [wordLookup, setWordLookup] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);
  const [solvedRowsCount, setSolvedRowsCount] = useState(0);
  const [mistakesRemaining, setMistakesRemaining] = useState(4);
  const [shake, setShake] = useState(false);

  /* -------------------------------------
     1. Fetch Sheet Names for the Dropdown
  -------------------------------------- */
  useEffect(() => {
    const fetchSheetNames = async () => {
      const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?key=${apiKey}`;
      try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.sheets) {
          const names = data.sheets.map(sheet => sheet.properties.title);
          setPuzzleList(names);
          // Read the query parameter directly
          const params = new URLSearchParams(window.location.search);
          const puzzleParam = params.get("puzzle");
          // If a valid query parameter exists and it matches one of the sheet names, use it;
          // otherwise, default to the first sheet.
          const sheetToSet = (puzzleParam && names.includes(puzzleParam)) ? puzzleParam : names[0];
          setCurrentSheet(sheetToSet);
        }
      } catch (error) {
        console.error("Error fetching sheet names:", error);
      }
    };
    fetchSheetNames();
  }, [spreadsheetId, apiKey]);


  /* -------------------------------------
     2. Fetch Puzzle Data from the Selected Sheet
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
          // Assume the first row contains headers:
          // e.g., ["Difficulty", "Category", "Clue 1", "Clue 2", "Clue 3", "Clue 4"]
          const puzzleData = rows.slice(1).map((row, i) => {
            return {
              difficulty: i,
              category: row[0],
              clues: [row[1], row[2], row[3], row[4]]
            };
          });
          setPuzzle(puzzleData);
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
    const words = [];
    const lookup = {};
    // We convert our puzzle data (an array of objects, one per row) into the format expected by our game.
    // For each puzzle row, we create an object with the key as the category and value as the clues array.
    const formattedPuzzle = puzzle.map(item => ({ [item.category]: item.clues }));
    formattedPuzzle.forEach((categoryObj, difficulty) => {
      const category = Object.keys(categoryObj)[0];
      categoryObj[category].forEach(word => {
        words.push(word);
        lookup[word] = { category, difficulty };
      });
    });
    setGrid(shuffleArray(words));
    setWordLookup(lookup);
    setSolvedRowsCount(0);
    setMistakesRemaining(4);
    setSelectedItems([]);
  }, [puzzle]);

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
    const solvedGrid = puzzle.reduce((acc, obj) => {
      const row = obj.clues; // clues array
      return acc.concat(row);
    }, []);
    setGrid(solvedGrid);
    setSolvedRowsCount(puzzle.length);
  };

  // Handle Submit: if 4 selected words all belong to the same category, swap them into the next unsolved row.
  const handleSubmit = () => {
    if (selectedItems.length !== 4) return;
    const firstCategory = wordLookup[selectedItems[0]].category;
    const allMatch = selectedItems.every(word => wordLookup[word].category === firstCategory);
    if (allMatch) {
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
      setShake(true);
      setTimeout(() => {
        setShake(false);
        const newMistakes = mistakesRemaining - 1;
        setMistakesRemaining(newMistakes);
        if (newMistakes === 0) {
          alert("Sorry you weren't able to solve the puzzle");
          solvePuzzle();
        }
      }, 500);
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

  // Handle puzzle change from dropdown.
  const handlePuzzleChange = (e) => {
    const sheetName = e.target.value;
    setCurrentSheet(sheetName);

    // Update the URL query parameter "puzzle" to the selected sheet.
    const params = new URLSearchParams(window.location.search);
    params.set("puzzle", sheetName);
    const newUrl = `${window.location.pathname}?${params.toString()}`;
    window.history.pushState({}, '', newUrl);
  };

  return (
    <div className="app-container">
      <div className="header">
        <label htmlFor="puzzle-select">Choose Puzzle: </label>
        <select id="puzzle-select" value={currentSheet} onChange={handlePuzzleChange}>
          {puzzleList.map((sheet, index) => (
            <option key={index} value={sheet}>{sheet}</option>
          ))}
        </select>
      </div>
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
