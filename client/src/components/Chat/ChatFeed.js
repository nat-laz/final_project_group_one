import ChatGroupSelector from "./ChatGroupSelector";
import ChatMessage from "./ChatMessage";

export default function ChatFeed() {
  return (
    <div 
        className="
            mt-4
            rounded-[25px]
            h-full
            grow
            p-6"

        style={{backgroundColor:"#212D42"}}>
        
        <ChatGroupSelector groupName="Group One"/>
        <ChatMessage
            alignment="text-left flex flex-col" 
            name="George" 
            message="Hi" 
            color="#6F76F8"
            text="white"/>

        <ChatMessage
            alignment="text-right flex flex-col items-end" 
            name="Melanie" 
            message="Hi, how are you doing?" 
            color="#D9D9D9"
            text="black"/>

        <ChatMessage
            alignment="text-left flex flex-col" 
            name="George" 
            message="Fine, thanks." 
            color="#6F76F8"
            text="white"/>
    </div>
  )
}
