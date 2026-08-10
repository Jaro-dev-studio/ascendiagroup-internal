"use client";

import { usePathname, useRouter } from "next/navigation";
import Modal from ".";
import { ReactNode, createContext, useContext, useEffect, useState } from "react";

interface ModalContextProps {
  // eslint-disable-next-line no-unused-vars
  show: (content: ReactNode, onClose?: () => any) => void;
  hide: () => void;
  forceShow: (content: ReactNode) => void;
  forceHide: () => void;
}

const ModalContext = createContext<ModalContextProps | undefined>(undefined);

export function ModalProvider({ children }: { children: ReactNode }) {

  const [modalContent, setModalContent] = useState<ReactNode | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [isForceShowing, setIsForceShowing] = useState(false);

  const [callback, setCallback] = useState<(() => void)| null>(null);

  const show = (content: ReactNode, onClose?: () => any) => {
    if(onClose){
      setCallback(onClose);
    }
    setModalContent(content);
    setShowModal(true);
  };

  const forceShow = (content: ReactNode) => {
    setModalContent(content);
    setIsForceShowing(true);
    setShowModal(true);
  };

  const forceHide = () => {
    setIsForceShowing(false);
    setShowModal(false);
    setTimeout(() => {
      setModalContent(null);
    }, 300); // Adjust this timeout as per your transition duration
  };

  const hide = () => {

    if(isForceShowing) {
      return;
    }

    if(callback){
      callback();
      setCallback(null);
    }

    setShowModal(false);
    setTimeout(() => {
      setModalContent(null);
    }, 300); // Adjust this timeout as per your transition duration
  };

  const pathname = usePathname();

  // Close modal when route changes
  useEffect(() => {
    setShowModal(false);
    setTimeout(() => {
      setModalContent(null);
    }, 300); // Adjust this timeout as per your transition duration
  }, [pathname]);

  return (
    <ModalContext.Provider value={{ show, hide, forceShow, forceHide }}>
      {children}
      {(showModal || isForceShowing) && (
        <Modal showModal={showModal} setShowModal={(showModal) => {
          if(showModal){
            show(modalContent);
          } else {
            hide();
          }
        }}
        >
          {modalContent}
        </Modal>
      )}
    </ModalContext.Provider>
  );
}

export function useModal() {
  return useContext(ModalContext);
}
