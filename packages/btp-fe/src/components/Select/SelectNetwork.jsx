import { useState } from 'react';
import styled from 'styled-components';
import ArrowIconSrc from 'assets/images/arrow-icon.svg';

const SelectStyled = styled.div`
  .custom-select-wrapper {
    border: none;
    position: relative;
    width: 235px;
  }
  .custom-select {
  }
  .custom-select__trigger {
    position: relative;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 22px;
    font-size: 16px;
    color: #eff1ed;
    height: 44px;
    background: ${(props) => (props.isOpen ? '#28262F' : '')};
    border-radius: 4px;
    line-height: 24px;
    letter-spacing: 1px;
    cursor: pointer;
  }
  .custom-options {
    position: absolute;
    display: block;
    width: 194px;
    top: 28px;
    right: 0;
    border: 1px solid #353242;
    box-shadow: 0px 4px 8px rgba(40, 38, 47, 0.8);
    border-radius: 4px;
    border-top: 0;
    transition: all 0.5s;
    opacity: 0;
    visibility: hidden;
    pointer-events: none;
    z-index: 2;
    padding-top: 4px;
  }
  .custom-select.open .custom-options {
    opacity: 1;
    visibility: visible;
    pointer-events: all;
  }
  .custom-option {
    position: relative;
    display: block;
    padding: 10px 16px;
    font-size: 14px;
    font-weight: 300;
    color: #eff1ed;
    cursor: pointer;
    transition: all 0.5s;
    background-color: #1d1b22;
    height: 40px;
  }
  .custom-option:hover {
    cursor: pointer;
    background-color: #312f39;
  }
  .custom-option.selected {
    background-color: #312f39;
    height: 40px;
  }
  .arrow {
    position: relative;
  }
`;
const SelectNetWork = () => {
  const listNetwork = [
    { value: 'bsc', label: 'Binance Smart Chain' },
    { value: 'ed', label: 'Edgeware' },
    { value: 'ic', label: 'ICON blockchain' },
  ];
  const [isOpenSelect, setIsOpenSelect] = useState(false);
  const [selectedValue, setSelectedValue] = useState(listNetwork[0]);
  const onToggleSelect = () => {
    setIsOpenSelect(!isOpenSelect);
  };
  const onSelectNetwork = (selectedValue) => {
    setSelectedValue(selectedValue);
  };
  return (
    <SelectStyled isOpen={isOpenSelect}>
      <div className="custom-select-wrapper" onClick={() => onToggleSelect()}>
        <div className={isOpenSelect ? 'custom-select open' : 'custom-select'}>
          <div className="custom-select__trigger">
            <span>{selectedValue.label}</span>
            <img className="arrow" src={ArrowIconSrc}></img>
          </div>
          <div className="custom-options">
            {listNetwork.map((network, i) => (
              <span
                className={`custom-option ${selectedValue.value === network.value && 'selected'}`}
                onClick={() => {
                  onSelectNetwork(network);
                }}
                key={i}
              >
                {network.label}
              </span>
            ))}
          </div>
        </div>
      </div>
    </SelectStyled>
  );
};
export default SelectNetWork;