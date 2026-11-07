const GoblinMood = {
  forCount(count) {
    if (count <= 5) return { name: "Happy", face: "😊", message: "Your browser is peaceful!", className: "happy" };
    if (count <= 15) return { name: "Relaxed", face: "😌", message: "A few tabs are gathering.", className: "relaxed" };
    if (count <= 30) return { name: "Worried", face: "😟", message: "The goblin is getting worried!", className: "worried" };
    if (count <= 50) return { name: "Overwhelmed", face: "😵", message: "Feed me these tabs!", className: "overwhelmed" };
    return { name: "Exhausted", face: "😫", message: "HELP! TOO MANY TABS!", className: "exhausted" };
  }
};
