import { useStreamingText } from "@/hooks/useStreamingText";
import { motion } from "framer-motion";

export default function StreamedMessage({ content }: { content: string }) {
    const { displayedText, isFinished } = useStreamingText(content);

    return (
        <>
            {displayedText}
            {!isFinished && (
                <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ repeat: Infinity, duration: 0.8, ease: "easeInOut" }}
                    className="inline-block w-1.5 h-3.5 ml-1 -mb-0.5 align-baseline bg-current rounded-sm opacity-70"
                />
            )}
        </>
    );
}