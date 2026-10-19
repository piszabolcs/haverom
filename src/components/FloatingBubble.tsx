interface Props {
  onOpen: () => void;
}

export default function FloatingBubble({ onOpen }: Props) {
  // The bubble sits centred in the (larger) transparent window, so its soft shadow can run
  // out on every side instead of being cut square at the window edge.
  return (
    <div className="flex h-full w-full items-center justify-center">
      <button
        type="button"
        onClick={onOpen}
        title="Haverom"
        aria-label="Haverom"
        data-testid="bubble"
        className="bubble-tile bubble-pulse flex h-[68px] w-[68px] items-center justify-center
                   transition-transform duration-150 hover:scale-105 active:scale-95"
      >
        <img
          src="./haverom_mascot.png"
          alt=""
          className="h-[54px] w-[54px] object-contain drop-shadow-[0_0_6px_rgba(98,236,190,0.55)]"
          draggable={false}
        />
      </button>
    </div>
  );
}
