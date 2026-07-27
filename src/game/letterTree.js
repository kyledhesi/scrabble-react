// Ported from model/LetterTree.java and model/LetterTreeNode.java.
//
// The AI-relevant method here is wordsContainingLetter(): given a handful of
// available letters (rack tiles + one "anchor" letter already locked on the
// board), find every dictionary word that can be spelled using those letters
// (each used at most once) and that contains the anchor letter somewhere in
// it.
//
// The original Java generates *every* index-permutation of every subset of
// the available letters first (up to 8!+7!+...+1! ~= 109,600 strings for an
// 8-letter rack), and only checks each finished string against the trie at
// the end. This port instead prunes the recursion the moment the trie has no
// child for the next letter - i.e. it walks the trie and the rack together,
// so a branch that can't possibly become a real word is abandoned
// immediately instead of being fully built out first. This finds exactly the
// same set of words (a trie miss on a prefix means no word anywhere starts
// with that prefix, by definition), just far faster - which matters a lot
// for keeping the AI's move responsive in a browser tab.

class LetterTreeNode {
  constructor() {
    this.isWord = false;
    this.children = new Map();
  }
}

export class LetterTree {
  constructor(words) {
    this.root = new LetterTreeNode();
    for (const word of words) {
      let node = this.root;
      for (const letter of word) {
        let child = node.children.get(letter);
        if (!child) {
          child = new LetterTreeNode();
          node.children.set(letter, child);
        }
        node = child;
      }
      node.isWord = true;
    }
  }

  lookup(word) {
    let node = this.root;
    for (const letter of word) {
      const child = node.children.get(letter);
      if (!child) return null;
      node = child;
    }
    return node;
  }

  isWord(word) {
    const node = this.lookup(word);
    return node != null && node.isWord;
  }

  // `letters` is an array of single-character strings (may repeat).
  // Returns a Set<string> of every valid word using each letter at most
  // once, that contains lockedLetter at least once.
  wordsContainingLetter(letters, lockedLetter) {
    const words = new Set();
    const used = new Array(letters.length).fill(false);

    const dfs = (node, prefix, containsLocked) => {
      if (node.isWord && prefix.length > 0 && containsLocked) {
        words.add(prefix);
      }
      for (let i = 0; i < letters.length; i++) {
        if (used[i]) continue;
        const letter = letters[i];
        const child = node.children.get(letter);
        if (!child) continue; // trie has no word with this prefix - prune
        used[i] = true;
        dfs(child, prefix + letter, containsLocked || letter === lockedLetter);
        used[i] = false;
      }
    };

    dfs(this.root, '', false);
    return words;
  }
}

// Builds a LetterTree from the same word list used for dictionary
// validation, mirroring LetterTree.basic_english() (which re-read
// dictionary.txt itself in the Java version).
export function buildLetterTree(words) {
  return new LetterTree(words);
}
