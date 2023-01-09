//! 01 - HOOKS
import { MainContext } from "../context/MainContext";
import { useForum } from "../context/ForumProvider";
import { useEffect, useContext } from "react";

//* 02 - COMPONENTS
import ForumSearch from "../components/Forum/ForumSearch";
import ListingPosts from "../components/Forum/ListingPosts";
import BarCreatePost from "../components/Forum/BarCreatePost";
import CreatePostModal from "../components/Forum/CreatePostModal";

const Forum = () => {
  const { showPostFormModal } = useContext(MainContext);
  const { getAllPost, posts } = useForum();

  useEffect(() => {
    getAllPost();
  }, []);

  return (
    <div
      className="
        w-screen
        h-screen
        overflow-auto
        bg-primary
        text-text-primary
        p-4
        md:px-6
        lg:px-10
        "
    >
      <div className="flex flex-col justify-between mb-4">
        <ForumSearch />
        <BarCreatePost />
      </div>

      <div className={!showPostFormModal ? "hidden" : ""}>
        <CreatePostModal getAllPost={getAllPost} />
      </div>

      {posts.length > 0 &&
        posts.map((post) => <ListingPosts key={post._id} post={post} />)}
    </div>
  );
};

export default Forum;
